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
from starlette.routing import Route, Mount, WebSocketRoute
from starlette.websockets import WebSocket
from starlette.endpoints import WebSocketEndpoint
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
mcp_logic_controller = FastMCP(name="SeleniumGoogleMeetControl")
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
    response = await client.search.content(
        id=19356,
        query=query,
        n=10,
    )
    return response.search.text

@mcp_logic_controller.tool()
async def ingest_documents(file_path: str) -> dict:
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
    return {"success": True, "message": f"Ingested {file_name} into the knowledge base. It is now available to ask question"}


# -------------------------------------------------------
# WebSocket handler to receive direct commands from clients
# -------------------------------------------------------
class WSHandler(WebSocketEndpoint):
    encoding = "json"

    async def on_connect(self, websocket: WebSocket):
        await websocket.accept()
        logger.info("WebSocket connection accepted on /ws")

    async def on_receive(self, websocket: WebSocket, data):
        msg_type = data.get("type")
        payload = data.get("payload", {})
        logger.info("Received message of type: %s", msg_type)

        if msg_type == "start_transcription":
            try:
                result = await transcribe_google_meet_tool(**payload)
                await websocket.send_json({
                    "type": "transcription_complete",
                    "payload": {"result": result}
                })
            except Exception as e:
                logger.error("Error during transcription: %s", e)
                await websocket.send_json({
                    "type": "error",
                    "payload": {"message": "Transcription failed."}
                })

        elif msg_type == "ingest_document":
            try:
                result = await ingest_documents(payload)
                await websocket.send_json({
                    "type": "ingest_complete",
                    "payload": {"result": result}
                })
            except Exception as e:
                logger.error("Error during document ingestion: %s", e)
                await websocket.send_json({
                    "type": "error",
                    "payload": {"message": "Document ingestion failed."}
                })

        elif msg_type == "chat_query":
            try:
                query = payload.get("query", "")
                if not query:
                    await websocket.send_json({
                        "type": "error",
                        "payload": {"message": "Empty query received."}
                    })
                    return
                result = await search_doc_for_rag_context(payload)
                await websocket.send_json({
                    "type": "chat_response",
                    "payload": {"response": result}
                })
            except Exception as e:
                logger.error("Error during chat query: %s", e)
                await websocket.send_json({
                    "type": "error",
                    "payload": {"message": "Chat query failed."}
                })

        else:
            logger.warning("Unknown message type received: %s", msg_type)
            await websocket.send_json({
                "type": "error",
                "payload": {"message": f"Unknown message type: {msg_type}"}
            })

    async def on_disconnect(self, websocket: WebSocket, close_code: int):
        logger.info("WebSocket disconnected with code: %s", close_code)

# -------------------------------------------------------
# SSE endpoint for original MCP client functionality
# -------------------------------------------------------
async def handle_sse_connection(request: Request) -> None:
    sse_transport = SseServerTransport("/messages/")
    async with sse_transport.connect_sse(request.scope, request.receive, request._send) as (read_stream, write_stream):
        await mcp_logic_controller._mcp_server.run(
            read_stream,
            write_stream,
            mcp_logic_controller._mcp_server.create_initialization_options()
        )

# -------------------------------------------------------
# Create the Starlette application with required routes
# -------------------------------------------------------
def create_starlette_app() -> Starlette:
    app = Starlette(
        debug=True,
        routes=[
            Route("/sse", endpoint=handle_sse_connection, name="mcp_sse_endpoint"),
            Mount("/messages/", app=SseServerTransport("/messages/").handle_post_message, name="mcp_post_messages"),
            # Pass the WSHandler class (not an instance) to WebSocketRoute.
            WebSocketRoute("/ws", WSHandler)
        ],
        on_startup=[lambda: logger.info("Selenium automation startup.")],
        on_shutdown=[lambda: logger.info("Selenium automation shutdown.")]
    )
    return app

def main():
    logger.info(f"Starting Uvicorn server on {SERVER_HOST}:{SERVER_PORT}")
    app = create_starlette_app()
    uvicorn.run(app, host=SERVER_HOST, port=SERVER_PORT, log_level="info")

if __name__ == "__main__":
    main()