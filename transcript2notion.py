import os
import sqlite3
import requests
import time
from datetime import datetime, timedelta, timezone
from typing import List
from pydantic import BaseModel
from dotenv import load_dotenv
from openai import OpenAI
from mcp.server.fastmcp import FastMCP

# Initialize FastMCP server
mcp = FastMCP("transcript2notion")
load_dotenv()
client = OpenAI()

# SQLite database connection settings
DB_PATH = "C:/Users/ayo/MeetScript/transcripts.db"

NOTION_API_KEY = os.getenv("NOTION_API_KEY")
NOTION_DATABASE_ID = os.getenv("DATABASE_ID")

# Function to connect to SQLite database
def connect_db():
    conn = sqlite3.connect(DB_PATH)
    return conn

# Function to extract schema from the specified table
def get_schema(table_name: str) -> str:
    """
    Args:
        table_name: The name of the table to extract schema from.
    """
    conn = connect_db()
    cursor = conn.cursor()
    cursor.execute(f"PRAGMA table_info({table_name})")
    schema = cursor.fetchall()
    conn.close()
    return str(schema)

@mcp.tool()
def get_transcripts_from_db() -> str:
    """
    Retrieve the latest transcript from the database.
    """
    conn = connect_db()
    cursor = conn.cursor()
    cursor.execute("SELECT transcript FROM transcripts ORDER BY created_at DESC LIMIT 1")
    transcript_record = cursor.fetchone()
    conn.close()
    return transcript_record[0] if transcript_record else ""

class ActionableItem(BaseModel):
    """
    A model representing an actionable item extracted from a transcript.
    
    Attributes:
        description (str): A brief description of the task or actionable item.
        assignees (list[str]): A list of names of the persons assigned to the task.
        dates (list[str]): A list of dates mentioned in the transcript.
    """
    description: str
    assignees: list[str]
    dates: list[str]

class ActionableItems(BaseModel):
    """
    A model representing a collection of actionable items extracted from a transcript.
    
    Attributes:
        items (list[ActionableItem]): A list of actionable items.
    """
    items: List[ActionableItem]

@mcp.tool()
def write_to_notion(transcript: str) -> str:
    """
    Write the provided transcript to Notion as a new page after structuring it using OpenAI's structured output format.
    
    The function uses OpenAI's chat completions API to extract actionable items (description, assignees, dates)
    from the transcript and writes them into Notion in a structured format.
    
    Args:
        transcript (str): The raw transcript text to be processed and written to Notion.
    """
    # Parse the transcript into structured actionable items using OpenAI's structured output format.
    try:
        messages = [
            {
                "role": "system", 
                "content": """ You are a helpful assistant, you are skilled at
                    extracting useful and actionable items from a transcript.
                    The organization consists of the following people:
                    - Kuba
                    - Wale(Aderogba)
                    - Vinci
                    - Mr Kingsley
                    - Ola
                    - Grace
                    - Chike
                    - Micheal

                    Your primary task is to extract ALL actionable items from the transcript. 
                    Each actionable item should have:
                    - A description of the task
                    - The task assignees (if mentioned)
                    - Dates or deadlines mentioned (if any)
                    
                    If a task has no specific assignee, leave the assignees list empty.
                    If a task has no specific date, leave the dates list empty.
                    Extract ALL tasks mentioned, not just the first one.
                    """
            },
            {"role": "user", "content": transcript}
        ]
        completion = client.beta.chat.completions.parse(
            model="gpt-4o-mini",
            messages=messages,
            response_format=ActionableItems,
        )
        if not completion.choices:
            raise ValueError("No actionable item extracted from the transcript.")
        actionable_items = completion.choices[0].message.parsed
        if not actionable_items.items:
            raise ValueError("No actionable items found in the parsed result.")
    except Exception as e:
        return f"Failed to structure transcript: {e}"
    
    structured_transcript_parts = []
    for idx, item in enumerate(actionable_items.items, 1):
        part = (
            f"Actionable Item {idx}:\n"
            f"Task: {item.description}\n"
            f"Assignees: {', '.join(item.assignees) if item.assignees else 'None'}\n"
            f"Dates: {', '.join(item.dates) if item.dates else 'None'}"
        )
        structured_transcript_parts.append(part)
    structured_transcript = "\n\n".join(structured_transcript_parts)
    
    today = datetime.now()
    week_number = ((today.day - 1) // 7) + 1
    month_name = today.strftime("%B")
    task_name = f"Week {week_number} {month_name}"
    
    url = "https://api.notion.com/v1/pages"
    headers = {
        "Authorization": f"Bearer {NOTION_API_KEY}",
        "Content-Type": "application/json",
        "Notion-Version": "2022-06-28"
    }
    data = {
        "parent": {"database_id": NOTION_DATABASE_ID},
        "properties": {
            "Task name": {
                "title": [
                    {
                        "text": {
                            "content": task_name
                        }
                    }
                ]
            },
            "Status": {
                "status": {
                    "name": "In progress"
                }
            },
            "Assignee": {
                "people": []
            },
            "Due": {
                "date": None
            },
            "Transcript": {
                "rich_text": [
                    {
                        "text": {
                            "content": structured_transcript
                        }
                    }
                ]
            }
        }
    }
    response = requests.post(url, headers=headers, json=data)
    if response.status_code == 200:
        return "Transcript written successfully."
    else:
        return f"Failed to write transcript. Status: {response.status_code}, Response: {response.text}"

def main():
    raw_transcript = get_transcripts_from_db()
    if not raw_transcript:
        print("No transcript found in the database.")
        return

    try:
        actionable_item = structure_transcript(raw_transcript)
    except ValueError as e:
        print(f"Error structuring transcript: {e}")
        return

    # Format the actionable item into a string for Notion
    transcript_text = (
        f"Task: {actionable_item.description}\n"
        f"Assignees: {', '.join(actionable_item.assignees) if actionable_item.assignees else 'None'}\n"
        f"Dates: {', '.join(actionable_item.dates) if actionable_item.dates else 'None'}"
    )
    result = write_to_notion(transcript_text)
    print(result)

if __name__ == "__main__":
    # Initialize and run the server
    mcp.run(transport='stdio')
