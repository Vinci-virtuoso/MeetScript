import os
import sys
import time
import logging
import asyncio
from selenium import webdriver
from selenium.webdriver.edge.service import Service as EdgeService
from selenium.webdriver.edge.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import pyautogui  
from realtime_stream import RealTimeTranscriber

# Global variable for the persistent automator instance
persistent_automator = None

def get_automator():
    """Get or create a persistent GoogleMeetAutomator instance."""
    global persistent_automator
    if persistent_automator is None:
        from script import GoogleMeetAutomator  # ensure import if necessary
        persistent_automator = GoogleMeetAutomator()
    return persistent_automator

def clear_automator_session():
    """Clear the persistent GoogleMeetAutomator instance."""
    global persistent_automator
    persistent_automator = None

class GoogleMeetAutomator:
    MEDIA_CONTINUE_IMAGE = r'C:\Users\ayo\MeetScript\directions\continue_without_media.png'

    def __init__(self, driver_path=r'/usr/local/bin/msedgedriver'):
        self.driver_path = driver_path
        self.driver = None
        self.setup_logging()
        # Define a persistent profile folder
        self.profile_path = "/app/selenium_profile"
        if not os.path.exists(self.profile_path):
            os.makedirs(self.profile_path)
            self.logger.info(f"Created persistent profile directory at {self.profile_path}")

    def setup_logging(self):
        self.logger = logging.getLogger(self.__class__.__name__)
        handler = logging.StreamHandler(sys.stdout)
        formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
        handler.setFormatter(formatter)
        self.logger.addHandler(handler)
        

    def setup_driver(self):
        try:
            # Define the lock file (could be "SingletonLock" or similar)
            lock_file = os.path.join(self.profile_path, "SingletonLock")
            if os.path.exists(lock_file):
                self.logger.info(f"Lock file found in profile directory: {lock_file}. Removing it.")
                os.remove(lock_file)

            # Debug: Check if msedgedriver exists at the expected driver path
            self.logger.debug(f"Type of self.driver_path: {type(self.driver_path)}; value: {self.driver_path}")
            if os.path.exists(self.driver_path):
                self.logger.info(f"msedgedriver found at {self.driver_path}")
            else:
                self.logger.error(f"msedgedriver NOT found at {self.driver_path}")

            # Debug: Check for the Microsoft Edge browser binary
            edge_binary = "/usr/bin/microsoft-edge"
            if os.path.exists(edge_binary):
                self.logger.info(f"Microsoft Edge binary found at {edge_binary}")
            else:
                self.logger.error(f"Microsoft Edge binary NOT found at {edge_binary}")

            # Debug: Retrieve and log Microsoft Edge version
            try:
                import subprocess
                edge_version = subprocess.check_output([edge_binary, "--version"], text=True).strip()
                self.logger.info(f"Microsoft Edge version: {edge_version}")
            except Exception as ex:
                self.logger.error(f"Failed to retrieve Microsoft Edge version: {ex}")

            self.logger.info("Initializing Selenium Options for Edge WebDriver")
            options = Options()
            options.use_chromium = True
            #Set binary_location to the Microsoft Edge browser binary, not the driver
            options.binary_location = edge_binary
            self.logger.debug(f"Selenium Options binary_location set to: {options.binary_location}")

            options.add_argument('--no-sandbox')
            options.add_argument('--disable-dev-shm-usage')
            options.add_argument('--force-dark-mode')
            options.add_argument("--disable-extensions")
            options.add_argument("--window-size=1920,1080")
            # options.add_argument(f"--user-data-dir={self.profile_path}")
            options.add_argument("--disable-blink-features=AutomationControlled")
            options.add_experimental_option("excludeSwitches", ["enable-automation"])
            options.add_experimental_option("useAutomationExtension", False)
            # Added option to disable notifications that might include microphone and camera prompts
            options.add_argument("--disable-notifications")
            # Automatically block microphone and camera permission pop-ups
            options.add_experimental_option("prefs", {
                "profile.managed_default_content_settings.media_stream_mic": 2,
                "profile.managed_default_content_settings.media_stream_camera": 2,
                "profile.default_content_setting_values.media_stream_mic": 2,
                "profile.default_content_setting_values.media_stream_camera": 2,
                "profile.default_content_setting_values.notifications": 2
            })
            self.logger.debug(f"Selenium Options arguments: {options.arguments}")

            self.logger.info(f"Initializing EdgeService with executable_path: {self.driver_path}")
            service = EdgeService(executable_path=self.driver_path)
            self.logger.info("Creating Edge WebDriver instance now")
            self.driver = webdriver.Edge(service=service, options=options)
            self.logger.info("WebDriver initialized successfully")
            return True
        except Exception as e:
            self.logger.error(f"Failed to initialize WebDriver: {e}")
            return False
        
    def is_user_signed_in(self):
        """
        Quickly determines if an account is already signed in by checking for the presence of 
        the 'Sign in' button without waiting. If the 'Sign in' button is found, the user is not signed in.
        """
        try:
            sign_in_elements = self.driver.find_elements(By.XPATH, "//span[contains(text(), 'Sign in')]")
            if sign_in_elements and sign_in_elements[0].is_displayed():
                self.logger.info("Sign in button found; user is not signed in.")
                return False
            else:
                self.logger.info("Sign in button not found; assuming user is already signed in.")
                return True
        except Exception as e:
            self.logger.info(f"Error detecting sign in button: {e}. Assuming user is already signed in.")
            return True
    def handle_media_permissions(self):
        """
        Dismiss the media permissions prompt using Selenium explicit wait.
        This looks for buttons that suggest 'Continue without', "Don't allow", or 'Cancel'.
        """
        try:
            wait = WebDriverWait(self.driver, 10)
            dismiss_xpath = "//*[contains(text(), 'Continue without') or contains(text(), \"Don't allow\") or contains(text(), 'Cancel')]"
            dismiss_button = wait.until(EC.element_to_be_clickable((By.XPATH, dismiss_xpath)))
            dismiss_button.click()
            self.logger.info("Dismissed media permissions prompt using Selenium explicit wait.")
            return True
        except Exception as e:
            self.logger.info("No media permissions prompt detected via Selenium explicit wait.")
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
        SIGN_IN_SELECTORS = [
            "//span[contains(text(), 'Sign in')]",
            "//div[contains(@aria-label, 'Sign in')]",
            "//div[contains(@class, 'sign-in')]//button"
        ]
        
        for selector in SIGN_IN_SELECTORS:
            try:
                return self.click_element(By.XPATH, selector, initial_delay=2)
            except Exception as e:
                self.logger.warning(f"Failed with selector {selector}: {e}")
        self.driver.save_screenshot("sign_in_failure.png")
        self.logger.error("All sign-in button selectors failed")
        return False

    def login(self, username, password):
        wait = WebDriverWait(self.driver, 15)
        try:
            email_input = wait.until(EC.visibility_of_element_located((By.ID, "identifierId")))
            email_input.clear()
            email_input.send_keys(username)
            self.logger.info("Entered username.")

            email_next = wait.until(EC.element_to_be_clickable((By.ID, "identifierNext")))
            email_next.click()
            self.logger.info("Clicked Next after entering username.")

            password_input = wait.until(EC.visibility_of_element_located((By.XPATH, "//input[@type='password']")))
            password_input.clear()
            password_input.send_keys(password)
            self.logger.info("Entered password.")

            password_next = wait.until(EC.element_to_be_clickable((By.ID, "passwordNext")))
            password_next.click()
            self.logger.info("Clicked Next after entering password.")
            return True
        except Exception as e:
            self.logger.error(f"Error during login: {e}")
            return False

    def join_meet(self):
        try:
            # Dismiss any possible media permission prompt.
            self.handle_media_permissions()
            wait = WebDriverWait(self.driver, 15)
            try:
                # Preferred: Click the 'Ask to join' button.
                ask_to_join_xpath = "//span[contains(text(), 'Ask to join')]"
                ask_to_join_button = wait.until(EC.element_to_be_clickable((By.XPATH, ask_to_join_xpath)))
                ask_to_join_button.click()
                self.logger.info("Clicked 'Ask to join' button.")
            except Exception:
                # Fallback: With a persisted session, the button may be 'Join now' (i.e., allow to join).
                join_now_xpath = "//span[contains(text(), 'Join now')]"
                join_now_button = wait.until(EC.element_to_be_clickable((By.XPATH, join_now_xpath)))
                join_now_button.click()
                self.logger.info("Clicked 'Join now' button.")
        except Exception as e:
            self.logger.error(f"Failed to join meet: {e}")

    async def automate_and_transcribe(self, meet_url, username, password, deepgram_api_key, meeting_duration=3600):
        """
        Integrated method to automate meeting and transcribe.
        Now includes detection of a persisted session to skip the login process when already signed in.
        """
        if not self.setup_driver():
            raise Exception("Driver setup failed")

        if not self.go_to_meet(meet_url):
            raise Exception("Failed to go to Meet URL")

        if not self.is_user_signed_in():
            if not self.click_sign_in():
                raise Exception("Failed to click Sign In")
            if not self.login(username, password):
                raise Exception("Login failed")
        else:
            self.logger.info("User is already signed in; skipping login.")

        self.join_meet()
        self.logger.info("Meeting joined successfully.")

        # Start the real-time transcription.
        transcriber = RealTimeTranscriber(deepgram_api_key, output_format="text", timestamps=True)
        transcriber.start()

        start_time = time.time()
        try:
            while time.time() - start_time < meeting_duration:
                try:
                    if not self.driver.window_handles:
                        self.logger.info("Browser window closed. Ending automation loop.")
                        break
                except Exception as e:
                    self.logger.error(f"Browser error: {e}. Ending automation loop.")
                    break
                # Check if the termination event was set (trigger word "goodbye" detected).
                if transcriber.termination_event.is_set():
                    self.logger.info("Termination event triggered by 'goodbye' command.")
                    break
                await asyncio.sleep(1)
        finally:
            try:
                await asyncio.wait_for(transcriber.stop(), timeout=5)
            except asyncio.TimeoutError:
                self.logger.error("Timed out waiting for transcriber.stop()")
            except Exception as err:
                self.logger.error(f"Error calling transcriber.stop: {err}")
            self.cleanup()
            clear_automator_session()


        # Now, start the real-time transcription
        transcriber = RealTimeTranscriber(deepgram_api_key, output_format="text",timestamps=True)
        transcriber.start()

        start_time = time.time()
        while time.time() - start_time < meeting_duration:
            try:
                if not self.driver.window_handles:
                    self.logger.info("Browser window closed. Ending automation loop.")
                    break
            except Exception as e:
                self.logger.error(f"Browser error: {e}. Ending automation loop.")
                break
            await asyncio.sleep(1)

        # Stop transcription when done.
        await transcriber.stop()
        self.cleanup()

    def cleanup(self):
        try:
            if self.driver:
                self.driver.quit()
                self.logger.info("Browser closed successfully.")
        except Exception as e:
            self.logger.error(f"Error during cleanup: {e}")

# In your main function, after gathering login info, meeting URL, and Deepgram API key
async def main():
    google_username = os.getenv("GOOGLE_USERNAME") or input("Enter your Gmail address: ").strip()
    google_password = os.getenv("GOOGLE_PASSWORD") or input("Enter your Google password: ").strip()
    meet_url = os.getenv("MEET_URL") or input("Enter your Google Meet URL: ").strip()
    deepgram_api_key = os.getenv("DEEPGRAM_API_KEY") or input("Enter your Deepgram API Key: ").strip()
    meeting_duration = 3600  # duration in seconds

    automator = GoogleMeetAutomator()
    try:
        await automator.automate_and_transcribe(meet_url, google_username, google_password, deepgram_api_key, meeting_duration)
    except Exception as e:
        automator.logger.error(f"Automation error: {e}")

if __name__ == "__main__":
    asyncio.run(main())