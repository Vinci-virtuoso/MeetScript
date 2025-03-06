# MeetScript

MeetScript is an internal tool built using MCP that automatically captures Google Meet meetings, transcribes them, stores them in Notion, and allows team members to query meeting notes and tasks.

## Features

- **Automatic Meeting Capture**: Records audio from Google Meet sessions.
- **Transcription**: Converts recorded audio into text for easy reference.
- **Notion Integration**: Stores transcriptions and meeting notes directly in Notion for organized access.
- **Query Functionality**: Allows team members to search and retrieve meeting notes and tasks efficiently.

## Prerequisites

Before using MeetScript, ensure you have the following installed:

- Python 3.x
- Required Python packages (see Installation section)
- Microsoft Edge WebDriver (for Selenium)

## Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd <repository-directory>
   ```

2. Install the required Python packages:
   ```bash
   pip install -r requirements.txt
   ```

3. Ensure you have the Microsoft Edge WebDriver installed and the path is correctly set in the script.

## Usage

1. Update the `main()` function in `script.py` with your Google credentials:
   ```python
   google_username = "your_email@gmail.com"
   google_password = "your_password"
   ```

2. Run the script:
   ```bash
   python script.py
   ```

3. When prompted, enter your Google Meet URL.

4. The script will handle the login process, join the meeting, and start recording automatically.

5. After the meeting, the audio will be transcribed and stored in Notion.

## Notes

- Ensure that you have the necessary permissions to record meetings and access Notion.
- Adjust the recording duration in the script as needed.

## Contributing

Contributions are welcome! Please submit a pull request or open an issue for any enhancements or bug fixes.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
