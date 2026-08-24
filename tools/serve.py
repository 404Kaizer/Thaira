"""http.server com Cache-Control: no-store e gravacao de patch de mapa.

`python -m http.server` nao manda cabecalho de cache nenhum, e ai o navegador
inventa um por conta propria a partir do Last-Modified. Resultado: voce edita o
JS, recarrega, e continua rodando o arquivo antigo -- "corrigi e nada mudou".

O POST existe para o editor de mapas (tools/editor.html) gravar em disco. A
alternativa era showSaveFilePicker, nativo do Chrome: ele obriga a escolher o
arquivo a cada gravacao, e ferramenta local nao deve pedir permissao para
trabalhar. Aqui o editor faz POST /patch/<nome> e pronto.

O servidor so grava em maps/<nome>.patch.json, e o <nome> passa por um filtro
de [a-z0-9_-]: e servidor de desenvolvimento rodando na sua maquina, mas um
handler que escreve onde o cliente mandar e um buraco mesmo assim.

Depois de gravar ele RECOMPOE: roda `node tools/mapas/<nome>.js`, que aplica o
patch e reescreve maps/<nome>.json -- o arquivo que o jogo carrega. Sem isso o
laco fica pela metade: o dono grava no editor e nada muda no jogo, porque o
patch nao e o mapa. E a saida do script volta para o editor, entao a conferencia
(componentes, pocas, rastro de objeto) aparece na hora em que a edicao foi
feita, e nao numa proxima vez que alguem rodar o script num terminal.
"""
import http.server
import json
import os
import re
import subprocess
import sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAPAS = os.path.join(RAIZ, 'maps')
NOME_OK = re.compile(r'^[a-z0-9_-]{1,40}$')


def serializa_patch(nome, dados):
    """O FORMATO DO PATCH. Gemeo do tools/patch_fmt.js, e o teste compara as duas
    saidas byte a byte -- dois escritores que discordam significa que gravar
    pelo navegador e gravar pelo launcher produzem arquivos diferentes.
    Sai do handler para poder ser exercido por teste: embutido, ele nao tinha
    como ser, e foi assim que a camada de OBJETO ficou de fora sem ninguem
    perceber. Uma entrada por linha, porque o patch entra no git."""
    def camada(chave, d):
        zs = [z for z in sorted(d, key=int) if d[z]]
        if not zs:
            return ['  "%s": {}' % chave]
        out = ['  "%s": {' % chave]
        for i, z in enumerate(zs):
            out.append('    "%s": [' % z)
            itens = d[z]
            for j, t in enumerate(itens):
                out.append('      %s%s' % (json.dumps(t, separators=(',', ':')),
                                           ',' if j + 1 < len(itens) else ''))
            out.append('    ]%s' % (',' if i + 1 < len(zs) else ''))
        out.append('  }')
        return out
    linhas = ['{', '  "nome": %s,' % json.dumps(nome)]
    bloco = camada('tiles', dados.get('tiles', {}))
    bloco[-1] += ','
    linhas += bloco + camada('objs', dados.get('objs', {})) + ['}']
    return chr(10).join(linhas) + chr(10)


def soma_patch(o):
    """As DUAS camadas: contando so `tiles`, uma sessao inteira de objeto
    passava pelo freio de encolhimento como "nao encolheu"."""
    return (sum(len(v) for v in o.get('tiles', {}).values())
            + sum(len(v) for v in o.get('objs', {}).values()))


class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def do_POST(self):
        if not self.path.startswith('/patch/'):
            return self.send_error(404)
        nome = self.path[len('/patch/'):].split('?')[0]
        if not NOME_OK.match(nome):
            return self.send_error(400, 'nome de mapa invalido')
        try:
            corpo = self.rfile.read(int(self.headers.get('Content-Length', 0)))
            dados = json.loads(corpo)
        except (ValueError, TypeError) as e:
            return self.send_error(400, 'json invalido: %s' % e)
        os.makedirs(MAPAS, exist_ok=True)
        alvo = os.path.join(MAPAS, nome + '.patch.json')
        # O PATCH SO CRESCE. O editor sempre manda o acumulado, entao gravacao
        # que ENCOLHE o arquivo nao veio dele -- veio de script, teste ou curl.
        # Foi assim que 1.632 tiles de trabalho viraram 2. Copia antes, recusa
        # depois; ?forcar=1 para o caso legitimo.
        soma = soma_patch
        antes = 0
        if os.path.exists(alvo):
            try:
                with open(alvo, encoding='utf-8') as f:
                    antes = soma(json.load(f))
                with open(alvo, 'rb') as f, open(alvo[:-5] + '.bak.json', 'wb') as g:
                    g.write(f.read())
            except (ValueError, OSError):
                pass
        novos = soma(dados)
        forcar = self.path.endswith('?forcar=1')
        if novos < antes and not forcar:
            self.send_response(409)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'ok': False, 'recompos': False, 'tiles': antes,
                'log': 'RECUSADO: a gravacao tem %d tiles e o patch em disco tem %d. '
                       'Nada foi escrito; ha copia em maps/%s.patch.bak.json.'
                       % (novos, antes, nome)}).encode())
            return
        # Um TILE por linha, e nao um numero por linha. O patch entra no git:
        # com json.dump(indent=1) cada coordenada vira uma linha e um patch de
        # 25 tiles ocupa 200 -- o diff deixa de se ler, que era o motivo de
        # indentar. E tudo numa linha so tem o mesmo defeito pelo outro lado.
        # AS DUAS CAMADAS. Este handler escrevia so `tiles`, e o `objs` que o
        # editor manda ia para o lixo -- o aplicaPatch le `o.objs`, que nunca
        # existia no arquivo. Toda edicao de OBJETO morria ao gravar, calada.
        # newline='' para o Python NAO traduzir a quebra de linha: o main.js
        # grava LF e este gravava CRLF, entao salvar por um servidor ou pelo
        # outro trocava o ARQUIVO INTEIRO no diff do git -- e o patch tem esta
        # formatacao justamente para o diff se ler. Achado comparando as duas
        # saidas byte a byte no teste.
        with open(alvo, 'w', encoding='utf-8', newline='') as f:
            f.write(serializa_patch(nome, dados))
        n = soma(dados)
        saida = {'ok': True, 'arquivo': alvo, 'tiles': n}
        saida.update(recompoe(nome))
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(saida).encode())


def recompoe(nome):
    """Roda o script de composicao e devolve o que ele disse.

    O `nome` ja passou pelo filtro [a-z0-9_-] e o arquivo tem de existir: nao ha
    caminho do cliente para o argumento do subprocess. Se o node nao estiver no
    PATH, isso e uma condicao normal (nem toda maquina tem) e vira aviso, nao
    erro -- o patch ja esta gravado e o dono pode rodar o script na mao.
    """
    script = os.path.join(RAIZ, 'tools', 'mapas', nome + '.js')
    if not os.path.exists(script):
        return {'recompos': False, 'log': 'nao ha tools/mapas/%s.js: o patch foi gravado, '
                                          'mas nada o aplica.' % nome}
    try:
        # encoding explicito: sem ele o Python decodifica com o locale do
        # sistema (cp1252 no Windows) e a saida do script, que e UTF-8, chega
        # ao editor como "bolsÃµes" e "Â·".
        r = subprocess.run(['node', script], cwd=RAIZ, capture_output=True,
                           text=True, encoding='utf-8', errors='replace',
                           timeout=120)
    except FileNotFoundError:
        return {'recompos': False, 'log': 'node nao encontrado no PATH. O patch foi gravado; '
                                          'rode "node tools/mapas/%s.js" para aplicar.' % nome}
    except subprocess.TimeoutExpired:
        return {'recompos': False, 'log': 'o script passou de 120s e foi interrompido.'}
    # 2 = mapa escrito e conferencia reclamando; o resto e o script ter quebrado
    aviso = r.returncode == 2
    return {'recompos': r.returncode == 0 or aviso, 'aviso': aviso,
            'log': (r.stdout or '') + (r.stderr or '')}


# GUARDA DE __main__, e ela não é formalidade: sem isto, IMPORTAR este arquivo
# SOBE UM SERVIDOR e trava quem importou. Foi o que aconteceu ao escrever o
# teste do serializador — o processo ficou pendurado até o timeout. Qualquer
# ferramenta que queira reusar `serializa_patch` esbarraria no mesmo.
if __name__ == '__main__':
    http.server.test(HandlerClass=NoCache,
                     port=int(sys.argv[1]) if len(sys.argv) > 1 else 8765)
