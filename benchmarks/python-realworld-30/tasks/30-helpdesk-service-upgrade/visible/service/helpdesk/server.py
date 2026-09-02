from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
class H(BaseHTTPRequestHandler):
 def do_GET(self): self.send_response(501);self.end_headers()
 def log_message(self,*a): pass
def serve(db,port):
 httpd=ThreadingHTTPServer(("127.0.0.1",port),H);print(f"LISTENING {httpd.server_port}",flush=True);httpd.serve_forever()
