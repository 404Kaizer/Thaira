"""http.server com Cache-Control: no-store.

`python -m http.server` nao manda cabecalho de cache nenhum, e ai o navegador
inventa um por conta propria a partir do Last-Modified. Resultado: voce edita o
JS, recarrega, e continua rodando o arquivo antigo -- "corrigi e nada mudou".
"""
import http.server
import sys


class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()


http.server.test(HandlerClass=NoCache,
                 port=int(sys.argv[1]) if len(sys.argv) > 1 else 8765)
