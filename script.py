import time
import logging
import threading
import pyautogui
import pyaudio
import wave
from datetime import datetime
import os

from selenium import webdriver
from selenium.webdriver.edge.service import Service as EdgeService
from selenium.webdriver.edge.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

class GoogleMeetAutoRecorder:
    def __init__(self, 
                 driver_path=r'C:\Users\ayo\Webdriver\msedgedriver.exe', 
                 join_template_path=r'C:\Users\ayo\MeetScript\ask_to_join.png',
                 recording_duration=3600):  # Default 1 hour recording
        # WebDriver Setup
        self.driver_path = driver_path
        self.join_template_path = join_template_path
        self.driver = None
        
        # Audio Recording Setup
        self.channels = 2
        self.rate = 44100
        self.chunk = 1024
        self.recording_duration = recording_duration
        
        # PyAudio initialization
        self.p = pyaudio.PyAudio()
        
        # Logging setup
        self.setup_logging()

    def setup_logging(self):
        """
        Sets up logging to track the flow of the script.
        """
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(levelname)s - %(message)s'
        )
        self.logger = logging.getLogger(__name__)
        
        # Ensure recordings directory exists
        os.makedirs('recordings', exist_ok=True)

    def setup_driver(self):
        """
        Sets up the Microsoft Edge WebDriver with options.
        """
        try:
            edge_options = Options()
            edge_options.add_argument('--no-sandbox')
            edge_options.add_argument('--disable-dev-shm-usage')
            edge_options.add_argument('--force-dark-mode')
            edge_options.add_argument("--disable-extensions")
            edge_options.add_argument("--window-size=1920,1080")
            edge_options.add_argument("--disable-blink-features=AutomationControlled")
            edge_options.add_experimental_option("excludeSwitches", ["enable-automation"])
            edge_options.add_experimental_option("useAutomationExtension", False)
            edge_options.add_experimental_option("prefs", {
                "profile.managed_default_content_settings.media_stream_mic": 2,
                "profile.managed_default_content_settings.media_stream_camera": 2,
                "profile.default_content_setting_values.media_stream_mic": 2,
                "profile.default_content_setting_values.media_stream_camera": 2
            })
            service = EdgeService(executable_path=self.driver_path)
            self.driver = webdriver.Edge(service=service, options=edge_options)
            self.logger.info("WebDriver initialized successfully")
            return True
        except Exception as e:
            self.logger.error(f"Failed to initialize WebDriver: {str(e)}")
            return False

    def handle_media_permissions(self):
        """
        Handles the media permissions popup.
        """
        try:
            time.sleep(2)
            continue_button_location = pyautogui.locateOnScreen('continue_without_media.png', confidence=0.8)
            if continue_button_location:
                x, y = pyautogui.center(continue_button_location)
                pyautogui.moveTo(x, y, duration=0.5)
                pyautogui.click()
                self.logger.info("Clicked 'Continue without microphone and camera'")
                return True
        except Exception as pyautogui_error:
            self.logger.error(f"Failed to handle media permissions popup: {pyautogui_error}")
            return False

    def go_to_meet(self, meet_url):
        """
        Navigates to the Google Meet URL.
        """
        try:
            self.driver.get(meet_url)
            self.logger.info(f"Navigated to Google Meet URL: {meet_url}")
            time.sleep(2)
            self.handle_media_permissions()
            return True
        except Exception as e:
            self.logger.error(f"Failed to navigate to Google Meet URL: {str(e)}")
            return False

    def login(self, username, password):
        """
        Logs into Google using the provided username and password.
        """
        wait = WebDriverWait(self.driver, 15)
        try:
            # Wait for the email input field
            email_input = wait.until(EC.visibility_of_element_located((By.ID, "identifierId")))
            email_input.clear()
            email_input.send_keys(username)
            self.logger.info("Entered username")
            
            email_next = wait.until(EC.element_to_be_clickable((By.ID, "identifierNext")))
            email_next.click()
            self.logger.info("Clicked Next after entering email")
            
            # Wait for the password input field
            password_input = wait.until(EC.visibility_of_element_located((By.XPATH, "//input[@type='password']")))
            password_input.clear()
            password_input.send_keys(password)
            self.logger.info("Entered password")
            
            password_next = wait.until(EC.element_to_be_clickable((By.ID, "passwordNext")))
            password_next.click()
            self.logger.info("Clicked Next after password")
            return True
        except Exception as e:
            self.logger.error(f"Error during login: {str(e)}")
            return False

    def join_meet(self):
        """
        Waits until the 'Ask to join' button is clickable and clicks it.
        """
        wait = WebDriverWait(self.driver, 15)
        try:
            # Allow additional time for the meeting page to load
            time.sleep(5)
            
            # Dismiss any overlay
            pyautogui.press('esc')
            self.logger.info("Pressed ESC to dismiss potential overlays")
            
            # Wait and click "Ask to join" button
            ask_to_join_button = wait.until(EC.element_to_be_clickable((By.XPATH, "//span[contains(text(), 'Ask to join')]")))
            ask_to_join_button.click()
            self.logger.info("Clicked 'Ask to join' button")
        except Exception as e:
            self.logger.error(f"Failed to click 'Ask to join' button: {e}")

    def start_audio_recording(self):
        """
        Start recording audio from system output
        """
        # Generate unique filename with timestamp
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_filename = f"recordings/meet_recording_{timestamp}.wav"
        
        # Open stream
        self.stream = self.p.open(
            format=pyaudio.paInt16,
            channels=self.channels,
            rate=self.rate,
            input=True,
            frames_per_buffer=self.chunk
        )
        
        self.frames = []
        self.is_recording = True
        
        self.logger.info(f"Started recording to {output_filename}")
        
        # Recording thread
        def record():
            start_time = time.time()
            
            while self.is_recording:
                # Check if we've reached recording duration
                if time.time() - start_time > self.recording_duration:
                    self.stop_audio_recording()
                    break
                
                # Read audio data
                data = self.stream.read(self.chunk)
                self.frames.append(data)
        
        # Start recording in a separate thread
        self.recording_thread = threading.Thread(target=record)
        self.recording_thread.start()
        
        return output_filename

    def stop_audio_recording(self):
        """
        Stop recording and save the audio file
        """
        self.is_recording = False
        
        # Wait for recording thread to finish
        self.recording_thread.join()
        
        # Stop and close the stream
        self.stream.stop_stream()
        self.stream.close()
        
        # Generate unique filename with timestamp
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_filename = f"recordings/meet_recording_{timestamp}.wav"
        
        # Save the recorded audio
        wf = wave.open(output_filename, 'wb')
        wf.setnchannels(self.channels)
        wf.setsampwidth(self.p.get_sample_size(pyaudio.paInt16))
        wf.setframerate(self.rate)
        wf.writeframes(b''.join(self.frames))
        wf.close()
        
        self.logger.info(f"Recording saved to {output_filename}")
        
        # Terminate PyAudio
        self.p.terminate()
        
        return output_filename

    def cleanup(self):
        """
        Closes the WebDriver and stops any ongoing recording.
        """
        try:
            # Stop recording if it's still ongoing
            if hasattr(self, 'is_recording') and self.is_recording:
                self.stop_audio_recording()
            
            # Close browser
            if self.driver:
                self.driver.quit()
                self.logger.info("Browser closed successfully")
        except Exception as e:
            self.logger.error(f"Error during cleanup: {str(e)}")

def main():
    # Update with your credentials
    google_username = "5eun3isiyktv@gmail.com"
    google_password = "Iaminevitable"
    meet_url = input("Enter your Google Meet URL: ").strip()
    
    # Recording duration (in seconds)
    recording_duration = 3600  # 1 hour
    
    # Initialize the Google Meet Auto Recorder
    meet_recorder = GoogleMeetAutoRecorder(recording_duration=recording_duration)

    try:
        # Setup WebDriver
        if not meet_recorder.setup_driver():
            print("WebDriver setup failed, aborting.")
            return

        # Navigate to Meet URL
        if not meet_recorder.go_to_meet(meet_url):
            print("Failed to navigate to Meet URL, aborting.")
            return

        # Login
        if not meet_recorder.login(google_username, google_password):
            print("Login failed, aborting.")
            meet_recorder.cleanup()
            return

        # Join Meet
        meet_recorder.join_meet()

        # Start Audio Recording
        meet_recorder.start_audio_recording()

        # Keep the script running for the recording duration
        time.sleep(recording_duration)

    except Exception as e:
        print(f"An error occurred: {e}")
    finally:
        # Cleanup
        meet_recorder.cleanup()

if __name__ == "__main__":
    main()