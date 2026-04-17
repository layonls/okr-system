import http.server
import socketserver
import json
import os

PORT = 80
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.join(os.path.dirname(BASE_DIR), "frontend")
DB_FILE = os.path.join(BASE_DIR, "db.json")

def load_data():
    if not os.path.exists(DB_FILE):
        return {"objectives": [], "key_results": []}
    with open(DB_FILE, "r") as f:
        return json.load(f)

def save_data(data):
    with open(DB_FILE, "w") as f:
        json.dump(data, f, indent=4)

class RequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=FRONTEND_DIR, **kwargs)

    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200, "ok")
        self.end_headers()

    def do_GET(self):
        if self.path == '/api/data':
            data = load_data()
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(data).encode())
        elif self.path.startswith('/api/'):
            self.send_response(404)
            self.end_headers()
        else:
            super().do_GET()

    def do_POST(self):
        content_length = int(self.headers.get('Content-Length', 0))
        post_data = self.rfile.read(content_length) if content_length > 0 else b'{}'
        body = json.loads(post_data.decode('utf-8'))
        
        data = load_data()

        if self.path == '/api/objectives':
            new_id = str(len(data['objectives']) + 1)
            body['id'] = new_id
            data['objectives'].append(body)
            save_data(data)
            
            self.send_response(201)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(body).encode())
            
        elif self.path == '/api/krs':
            new_id = str(len(data['key_results']) + 1)
            body['id'] = new_id
            
            months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
            for m in months:
                if m not in body:
                    body[m] = ""
                    
            data['key_results'].append(body)
            save_data(data)
            
            self.send_response(201)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(body).encode())
        else:
            self.send_response(404)
            self.end_headers()

    def do_PUT(self):
        content_length = int(self.headers.get('Content-Length', 0))
        put_data = self.rfile.read(content_length) if content_length > 0 else b'{}'
        body = json.loads(put_data.decode('utf-8'))

        data = load_data()

        if self.path.startswith('/api/krs/'):
            kr_id = self.path.split('/')[-1]
            found = False
            for i, kr in enumerate(data['key_results']):
                if kr['id'] == kr_id:
                    data['key_results'][i].update(body)
                    found = True
                    break
            if found:
                save_data(data)
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"status": "success"}).encode())
            else:
                self.send_response(404)
                self.end_headers()
                
        elif self.path.startswith('/api/objectives/'):
            obj_id = self.path.split('/')[-1]
            found = False
            for i, obj in enumerate(data['objectives']):
                if obj['id'] == obj_id:
                    data['objectives'][i].update(body)
                    found = True
                    break
            if found:
                save_data(data)
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"status": "success"}).encode())
            else:
                self.send_response(404)
                self.end_headers()
        else:
            self.send_response(404)
            self.end_headers()

    def do_DELETE(self):
        data = load_data()
        
        if self.path.startswith('/api/krs/'):
            kr_id = self.path.split('/')[-1]
            original_len = len(data['key_results'])
            data['key_results'] = [k for k in data['key_results'] if k['id'] != kr_id]
            
            if len(data['key_results']) < original_len:
                save_data(data)
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"status": "deleted"}).encode())
            else:
                self.send_response(404)
                self.end_headers()
                
        elif self.path.startswith('/api/objectives/'):
            obj_id = self.path.split('/')[-1]
            original_len = len(data['objectives'])
            data['objectives'] = [o for o in data['objectives'] if o['id'] != obj_id]
            data['key_results'] = [k for k in data['key_results'] if k.get('global_id') != obj_id and k.get('quarterly_id') != obj_id]
            data['objectives'] = [o for o in data['objectives'] if o.get('global_id') != obj_id]
            
            if len(data['objectives']) < original_len:
                save_data(data)
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"status": "deleted"}).encode())
            else:
                self.send_response(404)
                self.end_headers()
        else:
            self.send_response(404)
            self.end_headers()

with socketserver.TCPServer(("0.0.0.0", PORT), RequestHandler) as httpd:
    print("Serving on port", PORT)
    httpd.serve_forever()
