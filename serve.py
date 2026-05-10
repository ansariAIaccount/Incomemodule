#!/usr/bin/env python3
"""
serve.py — local server for the Loan Module Integration Layer.

Two endpoints in one process:
  • Static file server on / (same as `python3 -m http.server`)
  • POST proxy on /api/anthropic → api.anthropic.com/v1/messages

Why the proxy?
  Anthropic's API preflight (OPTIONS) does not reliably return the
  Access-Control-Allow-Origin header browsers require for direct
  cross-origin calls. The Loan Assistant chat is a browser app, so
  calling api.anthropic.com directly gets blocked by CORS.

  This proxy is same-origin with the page, so no CORS preflight is
  needed. It forwards the POST body to Anthropic with the API key,
  then returns the response back unchanged.

Usage:
  cd "/Users/ferhatansari/Claude Cowork folder/Claude Income Calculator"
  python3 serve.py
  → Open http://localhost:8080/loan-module-integration-layer.html

  Or pick a different port:
  python3 serve.py 9000
"""
import http.server
import socketserver
import urllib.request
import urllib.error
import sys
import json
import os

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
HOST = '127.0.0.1'
ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'

# Headers we forward from the browser to Anthropic. Everything else stripped.
FORWARD_HEADERS = {
    'x-api-key',
    'anthropic-version',
    'content-type',
}

class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Permissive CORS just in case the browser sends a preflight.
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, X-Api-Key, Anthropic-Version')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def do_POST(self):
        if self.path == '/api/anthropic':
            self._proxy_to_anthropic()
        else:
            self.send_error(404, 'POST endpoint not found')

    def _proxy_to_anthropic(self):
        try:
            length = int(self.headers.get('Content-Length', '0'))
            body = self.rfile.read(length) if length else b''
            # Build outbound headers — only allow-list what we forward
            out_headers = {}
            for h in FORWARD_HEADERS:
                val = self.headers.get(h)
                if val:
                    out_headers[h] = val
            # If the page didn't send x-api-key (e.g. forgot to fill Settings),
            # fail fast with a clear message.
            if 'x-api-key' not in out_headers:
                self.send_response(400)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({
                    'error': {'type': 'invalid_request_error',
                              'message': 'Missing x-api-key header. Set your Anthropic API key in the chat panel Settings.'}
                }).encode())
                return
            # Default the version if not supplied
            out_headers.setdefault('anthropic-version', '2023-06-01')
            out_headers.setdefault('content-type', 'application/json')

            req = urllib.request.Request(
                ANTHROPIC_URL, data=body, method='POST', headers=out_headers
            )
            try:
                with urllib.request.urlopen(req, timeout=60) as resp:
                    resp_body = resp.read()
                    self.send_response(resp.status)
                    self.send_header('Content-Type', resp.headers.get('Content-Type', 'application/json'))
                    self.end_headers()
                    self.wfile.write(resp_body)
            except urllib.error.HTTPError as e:
                # Pass Anthropic's error body through verbatim so the UI can
                # show it in the chat panel.
                err_body = e.read()
                self.send_response(e.code)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(err_body)
            except urllib.error.URLError as e:
                self.send_response(502)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({
                    'error': {'type': 'proxy_error',
                              'message': f'Could not reach api.anthropic.com: {e.reason}'}
                }).encode())
        except Exception as e:
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({
                'error': {'type': 'proxy_error', 'message': str(e)}
            }).encode())

    def log_message(self, fmt, *args):
        # Concise console output
        print(f'[{self.log_date_time_string()}] {fmt % args}')


def main():
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer((HOST, PORT), Handler) as httpd:
        print(f'─────────────────────────────────────────────────────────────')
        print(f'  Loan Module Integration Layer · local server')
        print(f'─────────────────────────────────────────────────────────────')
        print(f'  Open:      http://localhost:{PORT}/loan-module-integration-layer.html')
        print(f'  Static:    http://localhost:{PORT}/...')
        print(f'  API proxy: POST http://localhost:{PORT}/api/anthropic → api.anthropic.com')
        print(f'  Ctrl+C to stop')
        print(f'─────────────────────────────────────────────────────────────')
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print('\nShutting down.')


if __name__ == '__main__':
    main()
