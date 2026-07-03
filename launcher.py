import webview
import os
import sys

def get_base_path():
    if hasattr(sys, '_MEIPASS'):
        return sys._MEIPASS
    return os.path.dirname(os.path.abspath(__file__))

if __name__ == '__main__':
    # Path to index.html in the dist folder
    index_path = os.path.join(get_base_path(), "dist", "index.html")
    
    # Create the window
    window = webview.create_window(
        'Terratest LPD Tool v1.0', 
        url=index_path,
        width=1200, 
        height=900,
        resizable=True
    )
    
    # Start the engine
    webview.start()
