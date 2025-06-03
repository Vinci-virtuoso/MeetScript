This is a comprehensive Technical Product Requirements Document (PRD) for the "MeetScript 2.0" project, focusing on the backend architecture

Technical Product Requirements Document: MeetScript AI Backend


1. Introduction

This document outlines the technical specifications and architecture for the backend of "MeetScript AI," an intelligent Google Meet recording and transcription service. The primary goal is to detail the components, interactions, and technologies necessary to implement the automated meeting joining, real-time transcription, RAG-based querying, and persistent storage functionalities.

2. Goals & Objectives

The primary objective of the MeetScript AI backend is to reliably:

Automate Google Meet Joining: Programmatically join scheduled Google Meet sessions using Selenium, handling pre-join configurations (muting mic/camera, setting display name).

Real-time Audio Capture & Transcription: Capture live audio from the Google Meet session and stream it to a transcription service (Deepgram) for real-time, speaker-diarized transcription.

Run the whole google meeting session in a dockerized container using Xfvb for the virtual display screen, ffmpeg for audio extraction

Persistent Storage:Store raw meeting audio recordings securely.

Store real-time transcription chunks, linked to meeting and user IDs.

Store vector embeddings of transcription data for efficient RAG.

Real-time Frontend Communication: Provide dynamic status updates (e.g., "Joining...", "Recording...", "Transcript Update") to the frontend via WebSockets.

RAG-based Chat Querying: Enable users to ask questions about the meeting content (transcripts) in real-time or post-meeting, leveraging Retrieval-Augmented Generation (RAG).

Robustness & Scalability: Design a system capable of handling multiple concurrent meeting recordings reliably.

Resource Management: Ensure efficient management of browser contexts and audio streams to prevent resource exhaustion.