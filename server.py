import logging
import os
import uvicorn
from groundx import AsyncGroundX, Document
from dotenv import load_dotenv
from mcp.server.fastmcp import FastMCP
from mcp.server import Server  # for type hinting and accessing underlying server
from mcp.server.sse import SseServerTransport
from starlette.applications import Starlette
from starlette.requests import Request
from starlette.routing import Mount, Route
from script import GoogleMeetAutomator


load_dotenv()

api_key = os.getenv("GROUNDX_API_KEY")
print("GROUNDX_API_KEY:", api_key)
client = AsyncGroundX(api_key=api_key)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Get host and port from environment variables
SERVER_HOST = os.getenv("MCP_SERVER_HOST", "0.0.0.0")
SERVER_PORT = int(os.getenv("MCP_SERVER_PORT", "8000"))

# Create the FastMCP instance with a Selenium-specific name.
mcp_logic_controller = FastMCP(
    name="SeleniumGoogleMeetControl"
)
logger.info("FastMCP instance for 'SeleniumGoogleMeetControl' created.")

# Register the echo tool for testing.
@mcp_logic_controller.tool()
async def echo_tool(message: str) -> str:
    logger.info(f"MCP SERVER (SeleniumGoogleMeetControl): echo_tool received: '{message}'")
    return f"Echo from SeleniumGoogleMeetControl server (SSE): {message}"
    
@mcp_logic_controller.tool()
async def transcribe_google_meet_tool(
    meeting_url: str,
    google_username: str,
    google_password: str,
    deepgram_api_key: str,
    meeting_duration: int = 3600
) -> dict:
    logger.info("MCP SERVER (SeleniumGoogleMeetControl): transcribe_google_meet_tool invoked")
    try:
        automator = GoogleMeetAutomator()
        # The automator will launch the browser, join the meeting and start transcription.
        await automator.automate_and_transcribe(
            meeting_url,
            google_username,
            google_password,
            deepgram_api_key,
            meeting_duration
        )
        return {"success": True, "message": "Transcription completed successfully."}
    except Exception as e:
        logger.error(f"Error while transcribing: {e}", exc_info=True)
        return {"success": False, "error": str(e)}
    
@mcp_logic_controller.tool()
async def search_doc_for_rag_context(query: str) -> str:
    """
    Searches and retrieves relevant context from a knowledge base,
    based on the user's query.
    Args:
        query: The search query supplied by the user.
    Returns:
        str: Relevant text content that can be used by the LLM to answer the query.
    """
    response =await client.search.content(
        id=19356,
        query=query,
        n=10,
    )

    return response.search.text

@mcp_logic_controller.tool()
async def ingest_documents(local_file_path: str) -> dict:
    """
    Ingest documents from a local file into the knowledge base.
    Args:
        local_file_path: The path to the local file containing the documents to ingest.
    Returns:
        dict: A dictionary with keys 'success' and 'message' indicating the result of the ingestion.
    """
    # Use the fixed file path as specified
    file_path = "@transcript.txt"
    file_name = os.path.basename(file_path)
    client.ingest(
        documents=[
            Document(
                bucket_id=19356,
                file_name=file_name,
                file_path=file_path,
                file_type="txt",
                search_data={"key": "value"},
            )
        ]
    )
    return {"success": True, "message": f"Ingested {file_name} into the knowledge base. It should be available in a few minutes"}
# Define startup and shutdown functions for Starlette.
async def lifespan_startup():
    logger.info("Selenium automation startup.")

async def lifespan_shutdown():
    logger.info("Selenium automation shutdown.")

def create_starlette_app(
    mcp_server_instance: Server,
    sse_endpoint_path: str = "/sse",
    post_message_prefix: str = "/messages/",
    debug: bool = False
) -> Starlette:
    """
    Creates a Starlette application to serve the MCP server with SSE transport.
    """
    sse_transport = SseServerTransport(post_message_prefix)

    async def handle_sse_connection(request: Request) -> None:
        async with sse_transport.connect_sse(
            request.scope,
            request.receive,
            request._send,
        ) as (read_stream, write_stream):
            await mcp_server_instance.run(
                read_stream,
                write_stream,
                mcp_server_instance.create_initialization_options(),
            )

    app = Starlette(
        debug=debug,
        routes=[
            Route(sse_endpoint_path, endpoint=handle_sse_connection, name="mcp_sse_endpoint"),
            Mount(post_message_prefix, app=sse_transport.handle_post_message, name="mcp_post_messages"),
        ],
        on_startup=[lifespan_startup],
        on_shutdown=[lifespan_shutdown],
    )
    return app

def main():
    try:
        logger.info("Configuring SeleniumGoogleMeetControl MCP Server with Starlette and SSE transport.")

        # Get the underlying MCP Server instance.
        actual_mcp_server: Server = mcp_logic_controller._mcp_server

        # Create the Starlette application.
        starlette_app = create_starlette_app(
            actual_mcp_server,
            sse_endpoint_path="/sse",
            post_message_prefix="/messages/",
            debug=True
        )

        logger.info(f"Starting Uvicorn server. Listening on {SERVER_HOST}:{SERVER_PORT}.")
        logger.info(f"MCP SSE endpoint will be available at http://{SERVER_HOST}:{SERVER_PORT}/sse")

        # Run the Starlette app with Uvicorn.
        uvicorn.run(
            starlette_app,
            host=SERVER_HOST,
            port=SERVER_PORT,
            log_level="info"
        )
    except KeyboardInterrupt:
        logger.info("MCP Server interrupted by user. Graceful shutdown initiated.")
    except Exception as e:
        logger.error(f"An error occurred running the MCP server with Uvicorn: {e}", exc_info=True)

if __name__ == "__main__":
    main()