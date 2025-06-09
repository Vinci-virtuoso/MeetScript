import logging
import os
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
from groundx import AsyncGroundX, Document
from mcp.server.fastmcp import FastMCP
from script import GoogleMeetAutomator
from openai import OpenAI




logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

SERVER_HOST = os.getenv("MCP_SERVER_HOST", "0.0.0.0")
SERVER_PORT = int(os.getenv("MCP_SERVER_PORT", "8000"))

mcp_logic_controller = FastMCP(name="SeleniumGoogleMeetControl")
logger.info("FastMCP instance for 'SeleniumGoogleMeetControl' created.")


class EchoRequest(BaseModel):
    message: str

class TranscribeRequest(BaseModel):
    meeting_url: str
    google_username: str
    google_password: str
    deepgram_api_key: str
    meeting_duration: int = 3600

class SearchRequest(BaseModel):
    query: str
    openai_api_key: str 
    groundx_api_key: str

class IngestRequest(BaseModel):
    file_path: str
    groundx_api_key: str

class ActionableItem(BaseModel):
    """
    Represents an actionable item extracted from the transcript.
    """
    description: str
    assignees: List[str]
    dates: List[str]

class MeetingTranscriptResponse(BaseModel):
    """
    Structured response for a google meet transcript, containing a summary and actionable items.
    """
    summary: str
    actionable_items: List[ActionableItem]

@mcp_logic_controller.tool()
async def echo_tool(message: str) -> str:
    logger.info(f"echo_tool received: '{message}'")
    return f"Echo from SeleniumGoogleMeetControl server (HTTP): {message}"

@mcp_logic_controller.tool()
async def transcribe_google_meet_tool(
    meeting_url: str,
    google_username: str,
    google_password: str,
    deepgram_api_key: str,
    meeting_duration: int = 3600
) -> dict:
    logger.info("transcribe_google_meet_tool invoked")
    try:
        automator = GoogleMeetAutomator()
        await automator.automate_and_transcribe(
            meeting_url,
            google_username,
            google_password,
            deepgram_api_key,
            meeting_duration
        )
        logger.info("Transcription completed successfully.")
        return {"success": True, "message": "Transcription completed successfully."}
    except Exception as e:
        logger.error(f"Error while transcribing: {e}", exc_info=True)
        return {"success": False, "error": str(e)}

@mcp_logic_controller.tool()
async def search_doc_for_rag_context(query: str, openai_api_key: str, groundx_api_key: str) -> dict:
    client = AsyncGroundX(api_key=groundx_api_key)
    logger.info(f"search_doc_for_rag_context invoked with query: '{query}'")
    try:
        response = await client.search.content(
            id=19356,
            query=query,
            n=10,
        )
        logger.info(f"Raw transcript from search: {response.search.text}")

        # Use OpenAI's structured output parsing to extract a meeting summary and actionable items.
        openai_client = OpenAI(api_key=openai_api_key)
        structured_completion = openai_client.beta.chat.completions.parse(
            model="gpt-4o-2024-08-06",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a meeting summarizer. Given a google meet transcript, extract a concise summary "
                        "of the meeting and identify all actionable items. For each actionable item, provide a description "
                        "of the task, the names of the persons assigned (if any), and any dates or deadlines mentioned. "
                        "Return the result as structured JSON following this schema: "
                        "{\"summary\": <summary text>, \"actionable_items\": "
                        "[{\"description\": <description>, \"assignees\": [<list of names>], \"dates\": [<list of dates>]}]}."
                    )
                },
                {
                    "role": "user",
                    "content": f"Transcript: {response.search.text}"
                }
            ],
            response_format=MeetingTranscriptResponse,
        )
        message = structured_completion.choices[0].message
        if message.parsed:
            logger.info("Structured transcript parsing successful.")
            return message.parsed.model_dump()
        else:
            logger.warning("Structured transcript parsing failed, returning raw transcript.")
            return {"raw": response.search.text}
    except Exception as e:
        logger.error(f"Error during structured transcript parsing: {e}", exc_info=True)
        return {"error": str(e)}

@mcp_logic_controller.tool()
async def ingest_documents(file_path: str, groundx_api_key: str) -> dict:
    client = AsyncGroundX(api_key=groundx_api_key)
    # Override the file_path to always use r'transcript.txt'
    file_path = r'backend/transcript.txt'
    logger.info(f"ingest_documents invoked with file_path: '{file_path}'")
    try:
        file_name = os.path.basename(file_path)
        await client.ingest(
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
        logger.info(f"Ingested {file_name} into the knowledge base.")
        return {"success": True, "message": f"Ingested {file_name} into the knowledge base. It should be available in a few minutes"}
    except Exception as e:
        logger.error(f"Error during ingestion: {e}", exc_info=True)
        return {"success": False, "error": str(e)}

app = FastAPI(title="SeleniumGoogleMeetControl API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    logger.info("Selenium automation startup.")

@app.on_event("shutdown")
async def shutdown_event():
    logger.info("Selenium automation shutdown.")



@app.post("/api/echo")
async def api_echo(req: EchoRequest):
    logger.info(f"API call to /api/echo with message: {req.message}")
    result = await echo_tool(req.message)
    return JSONResponse(content={"result": result})

@app.post("/api/transcribe")
async def api_transcribe(req: TranscribeRequest):
    logger.info(f"API call to /api/transcribe with meeting_url: {req.meeting_url}")
    result = await transcribe_google_meet_tool(
        meeting_url=req.meeting_url,
        google_username=req.google_username,
        google_password=req.google_password,
        deepgram_api_key=req.deepgram_api_key,
        meeting_duration=req.meeting_duration
    )
    return JSONResponse(content=result)

@app.post("/api/search")
async def api_search(req: SearchRequest):
    logger.info(f"API call to /api/search with query: {req.query}")
    if not req.openai_api_key:
        raise HTTPException(status_code=400, detail="OpenAI API key is required")
    if not req.groundx_api_key:
        raise HTTPException(status_code=400, detail="GroundX API key is required")
    result = await search_doc_for_rag_context(req.query, req.openai_api_key, req.groundx_api_key)
    return JSONResponse(content={"result": result})

@app.post("/api/ingest")
async def api_ingest(req: IngestRequest):
    logger.info(f"API call to /api/ingest with file_path: {req.file_path}")
    if not req.groundx_api_key:
        raise HTTPException(status_code=400, detail="GroundX API key is required")
    result = await ingest_documents(req.file_path, req.groundx_api_key)
    return JSONResponse(content=result)

def main():
    try:
        logger.info("Starting SeleniumGoogleMeetControl API Server with FastAPI")
        uvicorn.run(app, host=SERVER_HOST, port=SERVER_PORT, log_level="info")
    except KeyboardInterrupt:
        logger.info("MCP Server interrupted by user. Graceful shutdown initiated.")
    except Exception as e:
        logger.error(f"An error occurred running the MCP server: {e}", exc_info=True)

if __name__ == "__main__":
    main()