import os
import sys
import subprocess

def main():
    workspace = os.path.dirname(os.path.abspath(__file__))
    venv_dir = os.path.join(workspace, "venv")
    
    # Verify if virtual environment exists
    if not os.path.exists(venv_dir):
        print("Creating Python virtual environment (venv)...")
        subprocess.check_call([sys.executable, "-m", "venv", "venv"])
        
    # Pick OS-specific executable paths
    if os.name == "nt":
        pip_exe = os.path.join(venv_dir, "Scripts", "pip.exe")
        python_exe = os.path.join(venv_dir, "Scripts", "python.exe")
    else:
        pip_exe = os.path.join(venv_dir, "bin", "pip")
        python_exe = os.path.join(venv_dir, "bin", "python")
        
    # Check dependencies installation
    requirements_file = os.path.join(workspace, "requirements.txt")
    if os.path.exists(requirements_file):
        print("Verifying and installing dependencies from requirements.txt...")
        subprocess.check_call([pip_exe, "install", "-r", "requirements.txt"])
        
    print("\n" + "="*60)
    print("  DigitalHub Unified AI Web Ecosystem is launching!")
    print("  Access the portal locally at: http://127.0.0.1:8000")
    print("  Press Ctrl+C to terminate the server session.")
    print("="*60 + "\n")
    
    # Fire up Uvicorn ASGI server
    try:
        subprocess.check_call([
            python_exe, "-m", "uvicorn", 
            "backend.main:app", 
            "--host", "127.0.0.1", 
            "--port", "8000"
        ])
    except KeyboardInterrupt:
        print("\nDigitalHub server stopped by user signal.")
    except Exception as e:
        print(f"\nServer crashed: {e}")

if __name__ == "__main__":
    main()
