import os
import sys
import time
import logging
import subprocess
from selenium import webdriver
from selenium.webdriver.edge.service import Service as EdgeService
from selenium.webdriver.edge.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import pyautogui  # Ensure that pyautogui is installed

class GoogleMeetRecorder:
    def __init__(self, 
                 driver_path=r'C:\Users\ayo\Webdriver\msedgedriver.exe',
                 output_dir=r'C:\Users\ayo\MeetScript\output',
                 video_name='meet_recording',
                 max_duration=7200,  # 2 hours
                 fast_mode=False):
        # Recording configuration
        self.output_dir = output_dir
        self.video_name = video_name
        self.max_duration = max_duration
        self.fast_mode = fast_mode
        
        # Ensure output directory exists
        os.makedirs(self.output_dir, exist_ok=True)
        
        # Logging setup
        self.setup_logging()
        
        # Recording process
        self.recording_process = None

    def setup_logging(self):
        self.logger = logging.getLogger(self.__class__.__name__)
        handler = logging.StreamHandler(sys.stdout)
        formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
        handler.setFormatter(formatter)
        self.logger.addHandler(handler)
        self.logger.setLevel(logging.INFO)

    def start_recording(self):
        """
        Start recording using FFmpeg for Windows
        """
        try:
            output_path = os.path.join(self.output_dir, f"{self.video_name}.mp4")
            # Windows-compatible FFmpeg command
            ffmpeg_args = [
                r"C:\Users\ayo\ffmpeg-2025-03-03-git-d21ed2298e-full_build\ffmpeg-2025-03-03-git-d21ed2298e-full_build\bin\ffmpeg.exe",
                "-y", "-loglevel", "error",
                "-f", "gdigrab", "-framerate", "30", "-i", "desktop",
                "-f", "dshow", "-i", "audio=Microphone Array (Intel® Smart Sound Technology (Intel® SST))",  # Updated line
                "-vcodec", "libx264", "-preset", "veryfast", 
                output_path
            ]
            self.recording_process = subprocess.Popen(ffmpeg_args)
            self.logger.info(f"Recording started: {output_path}")
            return True
        except Exception as e:
            self.logger.error(f"Failed to start recording: {e}")
            return False

    def stop_recording(self):
        """
        Stop FFmpeg recording process
        """
        try:
            if self.recording_process:
                # On Windows, use this signal instead
                self.recording_process.send_signal(subprocess.CTRL_C_EVENT)
                self.recording_process.wait()
                self.logger.info("Recording stopped successfully")
            return True
        except Exception as e:
            self.logger.error(f"Error stopping recording: {e}")
            return False

class GoogleMeetAutomator:
    MEDIA_CONTINUE_IMAGE = r'C:\Users\ayo\MeetScript\directions\continue_without_media.png'

    def __init__(self, recorder, driver_path=r'C:\Users\ayo\Webdriver\msedgedriver.exe'):
        self.recorder = recorder
        self.driver_path = driver_path
        self.driver = None
        self.setup_logging()

    def setup_logging(self):
        self.logger = logging.getLogger(self.__class__.__name__)
        handler = logging.StreamHandler(sys.stdout)
        formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
        handler.setFormatter(formatter)
        self.logger.addHandler(handler)
        self.logger.setLevel(logging.INFO)

    def setup_driver(self):
        try:
            options = Options()
            options.add_argument('--no-sandbox')
            options.add_argument('--disable-dev-shm-usage')
            options.add_argument('--force-dark-mode')
            options.add_argument("--disable-extensions")
            options.add_argument("--window-size=1920,1080")
            options.add_argument("--disable-blink-features=AutomationControlled")
            options.add_experimental_option("excludeSwitches", ["enable-automation"])
            options.add_experimental_option("useAutomationExtension", False)
            options.add_experimental_option("prefs", {
                "profile.managed_default_content_settings.media_stream_mic": 2,
                "profile.managed_default_content_settings.media_stream_camera": 2,
                "profile.default_content_setting_values.media_stream_mic": 2,
                "profile.default_content_setting_values.media_stream_camera": 2
            })
            service = EdgeService(executable_path=self.driver_path)
            self.driver = webdriver.Edge(service=service, options=options)
            self.logger.info("WebDriver initialized successfully")
            return True
        except Exception as e:
            self.logger.error(f"Failed to initialize WebDriver: {e}")
            return False

    def handle_media_permissions(self):
        try:
            time.sleep(2)
            location = pyautogui.locateOnScreen(self.MEDIA_CONTINUE_IMAGE, confidence=0.8)
            if location:
                x, y = pyautogui.center(location)
                pyautogui.moveTo(x, y, duration=0.5)
                pyautogui.click()
                self.logger.info("Dismissed media permissions prompt using pyautogui.")
                return True
            self.logger.warning("Media permissions prompt not found.")
            return False
        except Exception as e:
            self.logger.error(f"Error handling media permissions: {e}")
            return False

    def go_to_meet(self, meet_url):
        try:
            self.driver.get(meet_url)
            self.logger.info(f"Navigated to Google Meet URL: {meet_url}")
            time.sleep(2)
            self.handle_media_permissions()
            return True
        except Exception as e:
            self.logger.error(f"Failed to navigate to Meet URL: {e}")
            return False

    def click_element(self, by, locator, fallback_image=None, initial_delay=5):
        wait = WebDriverWait(self.driver, 15)
        try:
            time.sleep(initial_delay)
            element = wait.until(EC.element_to_be_clickable((by, locator)))
            element.click()
            self.logger.info(f"Clicked element with locator: {locator} using Selenium.")
            return True
        except Exception as e:
            self.logger.warning(f"Selenium click failed for {locator}: {e}")
            if fallback_image:
                time.sleep(2)
                location = pyautogui.locateOnScreen(fallback_image, confidence=0.8)
                if location:
                    x, y = pyautogui.center(location)
                    pyautogui.moveTo(x, y, duration=0.5)
                    pyautogui.click()
                    self.logger.info(f"Clicked element using fallback image: {fallback_image}")
                    return True
            self.logger.error(f"Failed to click element with locator: {locator}")
            return False

    def click_sign_in(self):
        SIGN_IN_XPATH = "//*[@id='yDmH0d']/c-wiz/div/div/div[38]/div[4]/div/div[2]/div[1]/div[2]/div[1]/div"
        return self.click_element(By.XPATH, SIGN_IN_XPATH, initial_delay=5)

    def login(self, username, password):
        wait = WebDriverWait(self.driver, 15)
        try:
            # Enter username
            email_input = wait.until(EC.visibility_of_element_located((By.ID, "identifierId")))
            email_input.clear()
            email_input.send_keys(username)
            self.logger.info("Entered username.")

            # Click Next after username
            email_next = wait.until(EC.element_to_be_clickable((By.ID, "identifierNext")))
            email_next.click()
            self.logger.info("Clicked Next after entering username.")

            # Enter password
            password_input = wait.until(EC.visibility_of_element_located((By.XPATH, "//input[@type='password']")))
            password_input.clear()
            password_input.send_keys(password)
            self.logger.info("Entered password.")

            # Click Next after password
            password_next = wait.until(EC.element_to_be_clickable((By.ID, "passwordNext")))
            password_next.click()
            self.logger.info("Clicked Next after entering password.")
            return True
        except Exception as e:
            self.logger.error(f"Error during login: {e}")
            return False

    def join_meet(self):
        try:
            time.sleep(5)
            pyautogui.press('esc')
            self.logger.info("Dismissed overlays using ESC key.")
            ASK_TO_JOIN_XPATH = "//span[contains(text(), 'Ask to join')]"
            wait = WebDriverWait(self.driver, 15)
            ask_to_join_button = wait.until(EC.element_to_be_clickable((By.XPATH, ASK_TO_JOIN_XPATH)))
            ask_to_join_button.click()
            self.logger.info("Clicked 'Ask to join' button.")
        except Exception as e:
            self.logger.error(f"Failed to join meet: {e}")

    def automate_and_record(self, meet_url, username, password):
        """
        Integrated method to automate meeting and record
        """
        try:
            # Start recording
            if not self.recorder.start_recording():
                raise Exception("Recording failed to start")

            # Setup driver and navigate
            if not self.setup_driver():
                raise Exception("Driver setup failed")

            if not self.go_to_meet(meet_url):
                raise Exception("Failed to go to Meet URL")

            if not self.click_sign_in():
                raise Exception("Failed to click Sign In")

            if not self.login(username, password):
                raise Exception("Login failed")

            self.join_meet()

            # Wait for meeting duration (or until meeting ends)
            time.sleep(self.recorder.max_duration)

            return True
        except Exception as e:
            self.recorder.logger.error(f"Automation failed: {e}")
            return False
        finally:
            # Always stop recording and cleanup
            self.recorder.stop_recording()
            self.cleanup()

    def cleanup(self):
        try:
            if self.driver:
                self.driver.quit()
                self.logger.info("Browser closed successfully.")
        except Exception as e:
            self.logger.error(f"Error during cleanup: {e}")

# The main function is now defined globally
def main():
    # Create recorder with custom configuration
    recorder = GoogleMeetRecorder(
        driver_path=r'C:\Users\ayo\Webdriver\msedgedriver.exe',
        video_name='meeting_recording',
        output_dir=r'C:\Users\ayo\MeetScript\output',
        max_duration=3600,  # 1 hour
        fast_mode=False
    )
    
    # Initialize the automator with the recorder
    automator = GoogleMeetAutomator(recorder)
    
    # Configuration for login and meeting URL
    google_username = "email@gmail.com"
    google_password = "password"
    meet_url = input("Enter your Google Meet URL: ").strip()

    automator.automate_and_record(meet_url, google_username, google_password)

if __name__ == "__main__":
    main()