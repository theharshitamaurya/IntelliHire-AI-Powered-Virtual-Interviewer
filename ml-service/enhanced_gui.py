"""
Enhanced IntelliHire GUI with Advanced AI Analysis
Features:
- 20-minute recording capability
- AI-powered question generation
- Comprehensive analysis and feedback
- Real-time performance indicators
- Professional interview simulation
"""

import tkinter as tk
from tkinter import messagebox, scrolledtext, ttk
import threading
import time
import os
import json
import uuid
import difflib
import cv2
import mediapipe as mp
import numpy as np
import speech_recognition as sr
from PIL import Image, ImageTk
from datetime import datetime
import requests
import random

# Import our advanced AI analyzer
from advanced_ai_analyzer import AdvancedAIAnalyzer

# Enhanced Configuration
RECORD_SECONDS = 1200  # 20 minutes total interview time
FRAME_RATE = 30
AUDIO_FILENAME_TEMPLATE = "answer_{}_{}.wav"
VIDEO_OUTPUT_DIR = "recordings"
os.makedirs(VIDEO_OUTPUT_DIR, exist_ok=True)

class EnhancedInterviewApp:
    def __init__(self, master):
        self.master = master
        master.title("IntelliHire - Advanced AI Interview Assistant")
        master.geometry("1200x800")
        master.configure(bg="#f0f0f0")

        # Initialize AI analyzer
        self.ai_analyzer = AdvancedAIAnalyzer()

        # Interview state
        self.current_question_index = 0
        self.interview_session_id = str(uuid.uuid4())
        self.interview_results = []
        self.is_recording = False
        self.start_time = None
        self.frames_buffer = []
        self.current_question_start = None

        # Load enhanced questions
        self.questions = self.load_enhanced_questions()

        # Initialize camera
        self.cap = None
        self.current_frame = None
        self._running = False

        # Setup GUI
        self.setup_gui()

        # Load AI feedback templates
        self.feedback_templates = self.load_feedback_templates()

    def setup_gui(self):
        """Setup the enhanced GUI with professional layout."""
        # Main title
        title_frame = tk.Frame(self.master, bg="#2c3e50", height=80)
        title_frame.pack(fill="x", padx=0, pady=0)
        title_frame.pack_propagate(False)

        title_label = tk.Label(
            title_frame, 
            text="IntelliHire - Advanced AI Interview Assistant",
            font=("Arial", 20, "bold"),
            fg="white",
            bg="#2c3e50"
        )
        title_label.pack(expand=True)

        # Main content area
        main_frame = tk.Frame(self.master, bg="#f0f0f0")
        main_frame.pack(fill="both", expand=True, padx=20, pady=10)

        # Left panel - Video and controls
        left_panel = tk.Frame(main_frame, bg="#ffffff", relief="raised", bd=2)
        left_panel.pack(side="left", fill="both", expand=True, padx=(0, 10))

        # Video display
        self.video_label = tk.Label(left_panel, bg="black", text="Camera Preview", 
                                   font=("Arial", 12), fg="white")
        self.video_label.pack(padx=10, pady=10, fill="both", expand=True)

        # Controls frame
        controls_frame = tk.Frame(left_panel, bg="#ffffff")
        controls_frame.pack(fill="x", padx=10, pady=10)

        # Progress bar
        self.progress_var = tk.DoubleVar()
        self.progress_bar = ttk.Progressbar(
            controls_frame, 
            variable=self.progress_var, 
            maximum=100,
            length=400
        )
        self.progress_bar.pack(fill="x", pady=(0, 10))

        # Time display
        self.time_label = tk.Label(
            controls_frame, 
            text="Ready to start interview",
            font=("Arial", 12, "bold"),
            bg="#ffffff"
        )
        self.time_label.pack(pady=(0, 10))

        # Control buttons
        button_frame = tk.Frame(controls_frame, bg="#ffffff")
        button_frame.pack(fill="x")

        self.start_button = tk.Button(
            button_frame, 
            text="Start Interview", 
            command=self.start_interview,
            bg="#27ae60", 
            fg="white", 
            font=("Arial", 12, "bold"),
            width=15,
            height=2
        )
        self.start_button.pack(side="left", padx=(0, 10))

        self.pause_button = tk.Button(
            button_frame, 
            text="Pause", 
            command=self.pause_interview,
            bg="#f39c12", 
            fg="white", 
            font=("Arial", 12, "bold"),
            width=10,
            height=2,
            state=tk.DISABLED
        )
        self.pause_button.pack(side="left", padx=(0, 10))

        self.stop_button = tk.Button(
            button_frame, 
            text="Stop Interview", 
            command=self.stop_interview,
            bg="#e74c3c", 
            fg="white", 
            font=("Arial", 12, "bold"),
            width=12,
            height=2,
            state=tk.DISABLED
        )
        self.stop_button.pack(side="left")

        # Right panel - Question and feedback
        right_panel = tk.Frame(main_frame, bg="#ffffff", relief="raised", bd=2)
        right_panel.pack(side="right", fill="both", expand=True)

        # Question display
        question_frame = tk.Frame(right_panel, bg="#34495e")
        question_frame.pack(fill="x", padx=0, pady=0)

        question_title = tk.Label(
            question_frame, 
            text="Interview Question",
            font=("Arial", 14, "bold"),
            fg="white",
            bg="#34495e"
        )
        question_title.pack(pady=10)

        self.question_label = tk.Label(
            right_panel,
            text="Click 'Start Interview' to begin your AI-powered mock interview session.",
            font=("Arial", 12),
            bg="#ffffff",
            wraplength=350,
            justify="center",
            pady=20
        )
        self.question_label.pack(fill="x", padx=20, pady=20)

        # Real-time feedback display
        feedback_title = tk.Label(
            right_panel, 
            text="Real-time AI Feedback",
            font=("Arial", 12, "bold"),
            bg="#ffffff"
        )
        feedback_title.pack(pady=(20, 10))

        self.realtime_feedback = tk.Text(
            right_panel, 
            height=8, 
            wrap=tk.WORD,
            font=("Arial", 10),
            state=tk.DISABLED
        )
        self.realtime_feedback.pack(fill="x", padx=20, pady=(0, 20))

        # Interview log
        log_title = tk.Label(
            right_panel, 
            text="Interview Progress Log",
            font=("Arial", 12, "bold"),
            bg="#ffffff"
        )
        log_title.pack(pady=(0, 10))

        self.log = scrolledtext.ScrolledText(
            right_panel, 
            height=10,
            font=("Arial", 9)
        )
        self.log.pack(fill="both", expand=True, padx=20, pady=(0, 20))

    def load_enhanced_questions(self):
        """Load enhanced question set with AI-driven follow-ups."""
        try:
            with open("enhanced_config.json", "r") as f:
                config_data = json.load(f)
                return config_data["questions"]
        except:
            # Fallback questions if file not found
            return [
                {
                    "id": 1,
                    "type": "introduction",
                    "question": "Tell me about yourself and your professional background",
                    "keywords": ["experience", "background", "skills", "education"],
                    "follow_up": "What specific achievements are you most proud of?",
                    "difficulty": "easy",
                    "expected_duration": 120
                },
                {
                    "id": 2,
                    "type": "behavioral",
                    "question": "Describe a challenging situation and how you handled it",
                    "keywords": ["challenge", "solution", "approach", "result"],
                    "follow_up": "What would you do differently?",
                    "difficulty": "medium",
                    "expected_duration": 150
                }
            ]

    def load_feedback_templates(self):
        """Load AI feedback templates for different scenarios."""
        return {
            "excellent": [
                "Outstanding performance! Your confidence and clarity are impressive.",
                "Excellent eye contact and professional presence throughout.",
                "Your structured approach to answering is very effective."
            ],
            "good": [
                "Good performance with strong technical knowledge demonstrated.",
                "Your examples are relevant and well-explained.",
                "Maintaining good composure under pressure."
            ],
            "needs_improvement": [
                "Consider expanding your answers with more specific examples.",
                "Try to maintain more consistent eye contact with the camera.",
                "Focus on structuring your responses using the STAR method."
            ],
            "encouragement": [
                "You're doing well - remember to breathe and stay relaxed.",
                "Take your time to think through your responses.",
                "Your expertise is showing through - keep up the momentum."
            ]
        }

    def log_text(self, text):
        """Add text to the interview log."""
        timestamp = datetime.now().strftime("%H:%M:%S")
        self.log.insert(tk.END, f"[{timestamp}] {text}\n")
        self.log.see(tk.END)
        self.master.update()

    def update_realtime_feedback(self, feedback):
        """Update the real-time feedback display."""
        self.realtime_feedback.config(state=tk.NORMAL)
        self.realtime_feedback.delete(1.0, tk.END)
        self.realtime_feedback.insert(tk.END, feedback)
        self.realtime_feedback.config(state=tk.DISABLED)
        self.master.update()

    def start_interview(self):
        """Start the enhanced AI interview session."""
        if self._running:
            return

        # Initialize camera
        self.cap = cv2.VideoCapture(0)
        if not self.cap.isOpened():
            messagebox.showerror("Error", "Could not access camera. Please check your camera connection.")
            return

        # Setup interview session
        self._running = True
        self.is_recording = True
        self.start_time = time.time()
        self.current_question_index = 0
        self.interview_results = []

        # Update UI
        self.start_button.config(state=tk.DISABLED)
        self.pause_button.config(state=tk.NORMAL)
        self.stop_button.config(state=tk.NORMAL)

        # Start threads
        threading.Thread(target=self.camera_preview_loop, daemon=True).start()
        threading.Thread(target=self.interview_management_loop, daemon=True).start()
        threading.Thread(target=self.update_progress_loop, daemon=True).start()

        self.log_text("AI Interview session started - 20 minutes available")
        self.update_realtime_feedback("Interview started! The AI is now analyzing your performance in real-time.")

    def pause_interview(self):
        """Pause/resume the interview."""
        if self.is_recording:
            self.is_recording = False
            self.pause_button.config(text="Resume")
            self.log_text("Interview paused")
            self.update_realtime_feedback("Interview paused. Click Resume when you're ready to continue.")
        else:
            self.is_recording = True
            self.pause_button.config(text="Pause")
            self.log_text("Interview resumed")
            self.update_realtime_feedback("Interview resumed. AI analysis continuing...")

    def stop_interview(self):
        """Stop the interview and generate final report."""
        self._running = False
        self.is_recording = False

        if self.cap:
            self.cap.release()

        # Update UI
        self.start_button.config(state=tk.NORMAL)
        self.pause_button.config(state=tk.DISABLED, text="Pause")
        self.stop_button.config(state=tk.DISABLED)

        self.log_text("Interview stopped - Generating comprehensive AI analysis...")

        # Generate final report
        threading.Thread(target=self.generate_final_report, daemon=True).start()

    def camera_preview_loop(self):
        """Main camera preview and frame capture loop."""
        while self._running and self.cap and self.cap.isOpened():
            ret, frame = self.cap.read()
            if not ret:
                break

            self.current_frame = frame.copy()

            # Store frames for analysis
            if self.is_recording:
                self.frames_buffer.append(frame.copy())
                # Limit buffer size to prevent memory issues
                if len(self.frames_buffer) > 1000:  # Keep last 1000 frames
                    self.frames_buffer = self.frames_buffer[-1000:]

            # Display frame
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            pil_image = Image.fromarray(rgb_frame)
            pil_image = pil_image.resize((640, 480))
            photo = ImageTk.PhotoImage(image=pil_image)

            self.video_label.config(image=photo)
            self.video_label.image = photo

            time.sleep(1.0 / FRAME_RATE)

        # Clean up
        self.video_label.config(image="", text="Camera Disconnected")

    def interview_management_loop(self):
        """Manage the interview flow and AI questioning."""
        question_start_time = time.time()
        current_question = None

        try:
            while self._running and self.current_question_index < len(self.questions):
                if not self.is_recording:
                    time.sleep(1)
                    continue

                # Check if we need to move to next question
                elapsed_time = time.time() - self.start_time
                question_elapsed = time.time() - question_start_time

                # Show current question
                if current_question != self.questions[self.current_question_index]:
                    current_question = self.questions[self.current_question_index]
                    question_text = f"Question {self.current_question_index + 1}: {current_question['question']}"
                    self.question_label.config(text=question_text)
                    self.log_text(f"Question {self.current_question_index + 1}: {current_question['question']}")
                    question_start_time = time.time()

                # Provide real-time encouragement
                if question_elapsed > 30 and question_elapsed < 35:
                    feedback = random.choice(self.feedback_templates["encouragement"])
                    self.update_realtime_feedback(f"💡 {feedback}")
                elif question_elapsed > 90:
                    feedback = "Take your time to provide a complete answer. Quality over speed!"
                    self.update_realtime_feedback(f"⏰ {feedback}")

                # Move to next question after expected duration or max time
                expected_duration = current_question.get("expected_duration", 120)
                if question_elapsed > expected_duration + 30 or question_elapsed > 180:  # Max 3 minutes per question
                    # Analyze current question response
                    self.analyze_current_response(current_question, question_start_time)

                    self.current_question_index += 1
                    question_start_time = time.time()

                # Check total interview time (20 minutes max)
                if elapsed_time > RECORD_SECONDS:
                    break

                time.sleep(1)

            # Interview completed
            if self._running:
                self.log_text("Interview completed - All questions answered!")
                self.stop_interview()

        except Exception as e:
            self.log_text(f"Interview management error: {e}")

    def analyze_current_response(self, question, question_start_time):
        """Analyze the current question response using AI."""
        try:
            # Get frames from the current question period
            question_frames = self.frames_buffer.copy()  # Use recent frames

            # Record and transcribe audio for this question
            audio_transcription = self.record_and_transcribe_audio(question["id"])

            # Perform AI analysis
            facial_analysis = self.ai_analyzer.analyze_facial_expressions(question_frames[-100:])  # Last 100 frames
            behavioral_analysis = self.ai_analyzer.analyze_behavioral_patterns(question_frames[-100:])
            content_analysis = self.ai_analyzer.analyze_content_quality(
                audio_transcription, 
                question.get("keywords", [])
            )

            # Generate feedback
            comprehensive_feedback = self.ai_analyzer.generate_comprehensive_feedback(
                facial_analysis, 
                {"voice_analysis_score": 75},  # Placeholder for voice analysis
                content_analysis, 
                behavioral_analysis,
                question.get("type", "general")
            )

            # Store results
            result = {
                "question_id": question["id"],
                "question": question["question"],
                "transcription": audio_transcription,
                "facial_analysis": facial_analysis,
                "content_analysis": content_analysis,
                "behavioral_analysis": behavioral_analysis,
                "comprehensive_feedback": comprehensive_feedback,
                "timestamp": datetime.now().isoformat()
            }

            self.interview_results.append(result)

            # Update real-time feedback
            score = comprehensive_feedback.get("overall_score", 0)
            if score > 80:
                feedback_category = "excellent"
            elif score > 60:
                feedback_category = "good"
            else:
                feedback_category = "needs_improvement"

            real_time_feedback = random.choice(self.feedback_templates[feedback_category])
            self.update_realtime_feedback(f"🎯 Score: {score:.1f}/100\n\n{real_time_feedback}")

            self.log_text(f"Question {question['id']} analyzed - Score: {score:.1f}/100")

        except Exception as e:
            self.log_text(f"Analysis error for question {question['id']}: {e}")

    def record_and_transcribe_audio(self, question_id, duration=10):
        """Record and transcribe audio for the current question."""
        try:
            recognizer = sr.Recognizer()

            with sr.Microphone() as source:
                recognizer.adjust_for_ambient_noise(source, duration=1)
                audio = recognizer.record(source, duration=min(duration, 10))

            # Save audio file
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            audio_path = os.path.join(VIDEO_OUTPUT_DIR, AUDIO_FILENAME_TEMPLATE.format(question_id, timestamp))

            with open(audio_path, "wb") as f:
                f.write(audio.get_wav_data())

            # Transcribe using Google Speech Recognition (free)
            try:
                transcription = recognizer.recognize_google(audio)
                return transcription
            except sr.UnknownValueError:
                return "[Speech not clearly understood]"
            except sr.RequestError as e:
                return f"[Speech recognition error: {e}]"

        except Exception as e:
            return f"[Audio recording error: {e}]"

    def update_progress_loop(self):
        """Update progress bar and time display."""
        while self._running:
            if self.start_time:
                elapsed = time.time() - self.start_time
                progress = min(100, (elapsed / RECORD_SECONDS) * 100)
                self.progress_var.set(progress)

                # Update time display
                elapsed_min = int(elapsed // 60)
                elapsed_sec = int(elapsed % 60)
                remaining_sec = max(0, RECORD_SECONDS - elapsed)
                remaining_min = int(remaining_sec // 60)
                remaining_sec = int(remaining_sec % 60)

                time_text = f"Elapsed: {elapsed_min:02d}:{elapsed_sec:02d} | Remaining: {remaining_min:02d}:{remaining_sec:02d}"
                self.time_label.config(text=time_text)

            time.sleep(1)

    def generate_final_report(self):
        """Generate comprehensive final interview report."""
        try:
            self.update_realtime_feedback("🔄 Generating comprehensive AI analysis report...")

            if not self.interview_results:
                self.log_text("No interview data to analyze")
                return

            # Calculate overall scores
            overall_scores = []
            all_feedback = {
                "strengths": [],
                "improvements": [],
                "recommendations": []
            }

            for result in self.interview_results:
                feedback = result.get("comprehensive_feedback", {})
                score = feedback.get("overall_score", 0)
                overall_scores.append(score)

                # Collect all feedback
                all_feedback["strengths"].extend(feedback.get("strengths", []))
                all_feedback["improvements"].extend(feedback.get("areas_for_improvement", []))
                all_feedback["recommendations"].extend(feedback.get("specific_recommendations", []))

            # Generate summary
            final_score = np.mean(overall_scores) if overall_scores else 0

            # Create detailed report
            report = {
                "session_id": self.interview_session_id,
                "timestamp": datetime.now().isoformat(),
                "total_questions": len(self.interview_results),
                "overall_score": final_score,
                "individual_results": self.interview_results,
                "summary": {
                    "strengths": list(set(all_feedback["strengths"])),
                    "areas_for_improvement": list(set(all_feedback["improvements"])),
                    "recommendations": list(set(all_feedback["recommendations"]))
                }
            }

            # Save report
            report_filename = f"interview_report_{self.interview_session_id[:8]}.json"
            with open(report_filename, "w") as f:
                json.dump(report, f, indent=2)

            # Display final results
            self.show_final_results(report)
            self.log_text(f"Final report saved: {report_filename}")

        except Exception as e:
            self.log_text(f"Report generation error: {e}")
            messagebox.showerror("Error", f"Failed to generate report: {e}")

    def show_final_results(self, report):
        """Display final interview results."""
        final_score = report["overall_score"]

        # Determine performance level
        if final_score >= 85:
            performance_level = "Excellent"
            performance_color = "#27ae60"
        elif final_score >= 70:
            performance_level = "Good"
            performance_color = "#f39c12"
        elif final_score >= 55:
            performance_level = "Fair"
            performance_color = "#e67e22"
        else:
            performance_level = "Needs Improvement"
            performance_color = "#e74c3c"

        # Create results window
        results_window = tk.Toplevel(self.master)
        results_window.title("AI Interview Analysis Results")
        results_window.geometry("800x600")
        results_window.configure(bg="#f8f9fa")

        # Title
        title_label = tk.Label(
            results_window,
            text="🎯 AI Interview Analysis Complete",
            font=("Arial", 18, "bold"),
            bg="#f8f9fa",
            fg="#2c3e50"
        )
        title_label.pack(pady=20)

        # Score display
        score_frame = tk.Frame(results_window, bg="#ffffff", relief="raised", bd=2)
        score_frame.pack(fill="x", padx=20, pady=10)

        score_label = tk.Label(
            score_frame,
            text=f"Overall Score: {final_score:.1f}/100",
            font=("Arial", 24, "bold"),
            fg=performance_color,
            bg="#ffffff"
        )
        score_label.pack(pady=20)

        performance_label = tk.Label(
            score_frame,
            text=f"Performance Level: {performance_level}",
            font=("Arial", 16),
            fg=performance_color,
            bg="#ffffff"
        )
        performance_label.pack(pady=(0, 20))

        # Summary notebook
        notebook = ttk.Notebook(results_window)
        notebook.pack(fill="both", expand=True, padx=20, pady=10)

        # Strengths tab
        strengths_frame = tk.Frame(notebook)
        notebook.add(strengths_frame, text="✅ Strengths")

        strengths_text = tk.Text(strengths_frame, wrap=tk.WORD, font=("Arial", 11))
        strengths_scroll = tk.Scrollbar(strengths_frame, orient=tk.VERTICAL, command=strengths_text.yview)
        strengths_text.config(yscrollcommand=strengths_scroll.set)

        strengths_content = "\n".join([f"• {strength}" for strength in report["summary"]["strengths"]])
        strengths_text.insert(tk.END, strengths_content if strengths_content else "Keep practicing to develop your strengths!")
        strengths_text.config(state=tk.DISABLED)

        strengths_text.pack(side=tk.LEFT, fill="both", expand=True)
        strengths_scroll.pack(side=tk.RIGHT, fill="y")

        # Improvements tab
        improvements_frame = tk.Frame(notebook)
        notebook.add(improvements_frame, text="🎯 Areas for Improvement")

        improvements_text = tk.Text(improvements_frame, wrap=tk.WORD, font=("Arial", 11))
        improvements_scroll = tk.Scrollbar(improvements_frame, orient=tk.VERTICAL, command=improvements_text.yview)
        improvements_text.config(yscrollcommand=improvements_scroll.set)

        improvements_content = "\n".join([f"• {improvement}" for improvement in report["summary"]["areas_for_improvement"]])
        improvements_text.insert(tk.END, improvements_content if improvements_content else "Great job! Continue maintaining your performance.")
        improvements_text.config(state=tk.DISABLED)

        improvements_text.pack(side=tk.LEFT, fill="both", expand=True)
        improvements_scroll.pack(side=tk.RIGHT, fill="y")

        # Recommendations tab
        recommendations_frame = tk.Frame(notebook)
        notebook.add(recommendations_frame, text="💡 Recommendations")

        recommendations_text = tk.Text(recommendations_frame, wrap=tk.WORD, font=("Arial", 11))
        recommendations_scroll = tk.Scrollbar(recommendations_frame, orient=tk.VERTICAL, command=recommendations_text.yview)
        recommendations_text.config(yscrollcommand=recommendations_scroll.set)

        recommendations_content = "\n".join([f"• {rec}" for rec in report["summary"]["recommendations"]])
        recommendations_text.insert(tk.END, recommendations_content if recommendations_content else "Keep up the excellent work!")
        recommendations_text.config(state=tk.DISABLED)

        recommendations_text.pack(side=tk.LEFT, fill="both", expand=True)
        recommendations_scroll.pack(side=tk.RIGHT, fill="y")

        # Close button
        close_button = tk.Button(
            results_window,
            text="Close",
            command=results_window.destroy,
            bg="#3498db",
            fg="white",
            font=("Arial", 12),
            width=20
        )
        close_button.pack(pady=20)

        # Update final feedback
        self.update_realtime_feedback(f"✅ Analysis Complete!\n\nFinal Score: {final_score:.1f}/100\nPerformance: {performance_level}")

def main():
    """Main function to run the enhanced interview application."""
    root = tk.Tk()
    app = EnhancedInterviewApp(root)

    # Handle window closing
    def on_closing():
        if app._running:
            app.stop_interview()
        root.destroy()

    root.protocol("WM_DELETE_WINDOW", on_closing)
    root.mainloop()

if __name__ == "__main__":
    main()