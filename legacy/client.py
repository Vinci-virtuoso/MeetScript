import asyncio
import json
import logging
import sys
from typing import Optional, List, Dict, Any # Kept Any for general type hinting
from contextlib import AsyncExitStack
from mcp import ClientSession
from mcp.client.sse import sse_client
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()  # load environment variables from .env

# Basic logging setup
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(name)s - %(message)s')
logger = logging.getLogger(__name__)

class MCPClientWithOpenAI:
    def __init__(self):
        self.session: Optional[ClientSession] = None
        self.exit_stack = AsyncExitStack()
        self.openai_client = OpenAI() 
        self._streams_context = None 
        self._session_context = None 

    async def connect_to_sse_server(self, server_url: str):
        """Connect to an MCP server running with SSE transport"""
        logger.info(f"Attempting to connect to SSE server at: {server_url}")
        self._streams_context = sse_client(url=server_url)
        streams = await self._streams_context.__aenter__()

        self._session_context = ClientSession(*streams)
        self.session: ClientSession = await self._session_context.__aenter__()

        await self.session.initialize()

        logger.info("Initialized SSE client.")
        logger.info("Listing tools...")
        response = await self.session.list_tools()
        # Assuming response.tools is a list of objects with .name, .description, .inputSchema
        tools_list = response.tools 
        logger.info(f"Connected to server with tools: {[tool.name for tool in tools_list]}")

    async def cleanup(self):
        """Properly clean up the session and streams"""
        logger.info("Cleaning up MCP client resources...")
        if self._session_context:
            try:
                await self._session_context.__aexit__(None, None, None)
                logger.info("ClientSession exited.")
            except Exception as e:
                logger.error(f"Error exiting ClientSession: {e}")
        if self._streams_context:
            try:
                await self._streams_context.__aexit__(None, None, None)
                logger.info("SSE streams context exited.")
            except Exception as e:
                logger.error(f"Error exiting SSE streams context: {e}")
        logger.info("Cleanup complete.")

    def _format_tools_for_openai(self, mcp_tools: List[Any]) -> List[Dict[str, Any]]:
        """
        Formats MCP tools for OpenAI's tool calling feature.
        Assumes each tool object in mcp_tools has .name, .description, and .inputSchema attributes.
        """
        openai_tools = []
        for tool in mcp_tools:
            try:
                openai_tools.append({
                    "type": "function",
                    "function": {
                        "name": tool.name,
                        "description": tool.description,
                        # Use inputSchema (camelCase) as per MCP convention / example
                        "parameters": tool.inputSchema 
                    }
                })
            except AttributeError as e:
                logger.warning(f"Tool object is missing an expected attribute (name, description, or inputSchema): {tool}. Error: {e}")
        return openai_tools

    async def process_query(self, query: str) -> str:
        """Process a query using OpenAI and available MCP tools"""
        if not self.session:
            logger.error("MCP session not established.")
            return "Error: MCP session not established."

        messages = [{"role": "user", "content": query}]

        list_tools_response = await self.session.list_tools()
        available_mcp_tools: List[Any] = list_tools_response.tools # Using List[Any]
        
        if not available_mcp_tools:
            logger.warning("No tools available from the MCP server. Querying OpenAI directly.")
            try:
                openai_response = self.openai_client.chat.completions.create(
                    model="gpt-4o", 
                    messages=messages
                )
                return openai_response.choices[0].message.content or "No response from LLM."
            except Exception as e:
                logger.error(f"OpenAI API call failed (no tools): {e}")
                return f"Error communicating with OpenAI: {str(e)}"

        formatted_openai_tools = self._format_tools_for_openai(available_mcp_tools)
        
        if not formatted_openai_tools: # If tools existed but formatting failed for all
            logger.warning("MCP tools were found but could not be formatted for OpenAI. Querying OpenAI directly.")
            try:
                openai_response = self.openai_client.chat.completions.create(
                    model="gpt-4o",
                    messages=messages
                )
                return openai_response.choices[0].message.content or "No response from LLM."
            except Exception as e:
                logger.error(f"OpenAI API call failed (tool formatting issue): {e}")
                return f"Error communicating with OpenAI: {str(e)}"


        logger.info(f"Sending query to OpenAI with tools: {[t['function']['name'] for t in formatted_openai_tools]}")

        try:
            response = self.openai_client.chat.completions.create(
                model="gpt-4o", 
                messages=messages,
                tools=formatted_openai_tools,
                tool_choice="auto", 
            )
        except Exception as e:
            logger.error(f"OpenAI API call failed: {e}")
            return f"Error communicating with OpenAI: {str(e)}"

        response_message = response.choices[0].message
        tool_calls = response_message.tool_calls

        messages.append(response_message) 

        final_response_parts = []
        if response_message.content:
            final_response_parts.append(response_message.content)

        if tool_calls:
            logger.info(f"OpenAI requested tool calls: {tool_calls}")
            for tool_call in tool_calls:
                function_name = tool_call.function.name
                try:
                    function_args_str = tool_call.function.arguments
                    function_args = json.loads(function_args_str)
                except json.JSONDecodeError as e:
                    logger.error(f"Error decoding tool arguments for {function_name}: {function_args_str}. Error: {e}")
                    tool_result_content = f"Error: Invalid arguments format for {function_name}."
                    messages.append({
                        "tool_call_id": tool_call.id, "role": "tool",
                        "name": function_name, "content": tool_result_content,
                    })
                    final_response_parts.append(f"[Error processing arguments for {function_name}]")
                    continue
                logger.info(f"Calling MCP tool: {function_name} with args: {function_args}")
                final_response_parts.append(f"[Calling MCP tool {function_name} with args {function_args}]")

                try:
                    mcp_tool_result = await self.session.call_tool(function_name, function_args)
                    tool_output_content = mcp_tool_result.content # This is the object of interest

                    # Log the raw content type and representation first
                    try:
                        logger.info(f"MCP tool {function_name} content PRE-PROCESSING - Type: {type(tool_output_content)}, Repr: {repr(tool_output_content)}")
                    except Exception as log_e:
                        logger.error(f"Error during logging of raw tool content type/repr: {log_e}")
                        # Continue, as this logging error isn't critical for functionality

                    # Attempt to get a clean string representation for OpenAI
                    processed_content_for_openai = ""
                    try:
                        # Case 1: If it has a .text attribute that is a string, use that.
                        if hasattr(tool_output_content, 'text') and isinstance(getattr(tool_output_content, 'text', None), str):
                            processed_content_for_openai = getattr(tool_output_content, 'text')
                            logger.info(f"Used .text attribute: '{processed_content_for_openai}'")
                        # Case 2: If it's already a string.
                        elif isinstance(tool_output_content, str):
                            processed_content_for_openai = tool_output_content
                            logger.info(f"Content was already a string: '{processed_content_for_openai}'")
                        # Case 3: If it's a dictionary or list, attempt to JSON serialize it robustly.
                        elif isinstance(tool_output_content, (dict,list)):
                             logger.info(f"Content is dict/list, attempting robust json.dumps.")
                             def robust_json_default_serializer(o):
                                if hasattr(o, 'text') and isinstance(getattr(o, 'text', None), str):
                                    return getattr(o, 'text')
                                # Add other known MCP types here if necessary by checking their actual class
                                # e.g., if type(o).__name__ == 'SomeOtherMCPType': return o.some_value
                                return str(o) # Fallback for any other unhandled type within dict/list
                             processed_content_for_openai = json.dumps(tool_output_content, default=robust_json_default_serializer)
                             logger.info(f"JSON serialized dict/list: {processed_content_for_openai}")
                        # Case 4: Fallback for other types (e.g., TextContent obj itself, numbers, etc.)
                        else:
                            logger.info(f"Content (type: {type(tool_output_content)}) is not str, dict/list, or .text yielding str. Falling back to str().")
                            processed_content_for_openai = str(tool_output_content)
                            logger.info(f"Used str() fallback: '{processed_content_for_openai}'")
                            
                    except Exception as e_processing:
                        logger.error(f"Error during tool output processing for {function_name}: {e_processing}. Falling back to a generic error string for OpenAI.", exc_info=True)
                        # Provide a meaningful error string to OpenAI if processing fails.
                        processed_content_for_openai = f"Error processing result from tool {function_name}: {str(e_processing)}"
                    
                    tool_output_str = processed_content_for_openai # This is what gets sent to OpenAI
                    
                    # The rest of your logging for this specific string can be simpler now:
                    logger.info(f"MCP tool {function_name} final stringified result for OpenAI: {tool_output_str}")
                    
                    messages.append({
                        "tool_call_id": tool_call.id, "role": "tool",
                        "name": function_name, "content": tool_output_str, # Send the processed string
                    })
                except Exception as e: # This outer try-except catches errors from session.call_tool or the processing block
                    logger.error(f"Error calling MCP tool {function_name} or processing its result: {e}", exc_info=True)
                    error_content = f"Error executing tool {function_name}: {str(e)}"
                    messages.append({
                        "tool_call_id": tool_call.id, "role": "tool",
                        "name": function_name, "content": error_content,
                    })
                    final_response_parts.append(f"[Error executing MCP tool {function_name}: {str(e)}]")
            logger.info("Sending tool results back to OpenAI for final response...")
            try:
                second_response = self.openai_client.chat.completions.create(
                    model="gpt-4o", messages=messages,
                )
                final_response_message = second_response.choices[0].message.content
                if final_response_message:
                    final_response_parts.append(final_response_message)
            except Exception as e:
                logger.error(f"Second OpenAI API call failed: {e}")
                final_response_parts.append(f"Error getting final response from OpenAI: {str(e)}")
        
        if not final_response_parts and not response_message.content and not tool_calls :
             return "I was unable to process your request or the LLM chose not to respond with text."
        elif not final_response_parts and (response_message.content or tool_calls): # Should not happen if logic is correct
            return response_message.content or "Tool processing initiated but no final text generated."


        return "\n".join(final_response_parts)

    async def chat_loop(self):
        """Run an interactive chat loop"""
        print("\nOpenAI + MCP Client Started!")
        print("Type your queries or 'quit' to exit.")
        
        while True:
            try:
                query = input("\nQuery: ").strip()
                
                if query.lower() == 'quit':
                    logger.info("User requested to quit.")
                    break
                    
                response_text = await self.process_query(query)
                print("\n" + response_text)
                    
            except KeyboardInterrupt:
                logger.info("Chat loop interrupted by user (KeyboardInterrupt).")
                break
            except Exception as e:
                logger.error(f"Error in chat loop: {e}", exc_info=True)
                print(f"\nAn unexpected error occurred: {str(e)}")


async def main():
    if len(sys.argv) < 2:
        print("Usage: python client.py <URL of SSE MCP server (e.g., http://localhost:8000/sse)>")
        sys.exit(1)

    server_url = sys.argv[1]
    client = MCPClientWithOpenAI()
    try:
        await client.connect_to_sse_server(server_url=server_url)
        await client.chat_loop()
    except Exception as e:
        logger.error(f"An error occurred in main: {e}", exc_info=True)
    finally:
        logger.info("Initiating client cleanup...")
        await client.cleanup()
        logger.info("Client shutdown complete.")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Application terminated by user.")