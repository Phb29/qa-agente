#!/usr/bin/env bash
# Lista as conversas de revisao (threads) NAO resolvidas nos PRs abertos de uma branch no GitHub.
# Usado pelo coordenador antes de mandar o ticket para teste: thread aberta = o dev ainda tem
# ajuste pendente de revisao -> devolve o ticket (docs/devolucao-ticket.md).
#
# So leitura, pelo gh CLI ja logado na maquina (gh auth status). Nao comenta, nao resolve nada.
#
# Uso:  bash tools/threads-abertas.sh <org/repo ou URL de clone> <branch>
#   ex: bash tools/threads-abertas.sh git@github.com:SUA-ORG/backend.git feature/ABC-123
# Saida (JSON): [{"pr": 15, "url": "...", "titulo": "...", "abertas": 2,
#                 "threads": [{"arquivo": "...", "autor": "...", "trecho": "..."}]}]
#   lista vazia = nenhum PR aberto com thread pendente.
# Codigo 2 = gh sem login ou repositorio inacessivel (nao da para conferir: nao e culpa do ticket).
set -euo pipefail

ALVO="${1:?uso: bash tools/threads-abertas.sh <org/repo ou URL> <branch>}"
BRANCH="${2:?uso: bash tools/threads-abertas.sh <org/repo ou URL> <branch>}"
REPO=$(echo "$ALVO" | sed -E 's#^(git@github\.com:|https://github\.com/)##; s#\.git$##')
DONO=${REPO%%/*}; NOME=${REPO#*/}

gh auth status >/dev/null 2>&1 || { echo "gh sem login" >&2; exit 2; }

PRS=$(gh pr list --repo "$REPO" --head "$BRANCH" --state open --json number --jq '.[].number' 2>/dev/null) \
  || { echo "repositorio inacessivel: $REPO" >&2; exit 2; }

saida="["
primeiro=1
for pr in $PRS; do
  json=$(gh api graphql -F dono="$DONO" -F nome="$NOME" -F pr="$pr" -f query='
    query($dono:String!,$nome:String!,$pr:Int!){
      repository(owner:$dono,name:$nome){ pullRequest(number:$pr){
        url title
        reviewThreads(first:100){ nodes{ isResolved isOutdated path
          comments(first:1){ nodes{ author{login} body } } } } } } }')
  item=$(echo "$json" | python -c '
import json,sys
p=json.load(sys.stdin)["data"]["repository"]["pullRequest"]
ab=[t for t in p["reviewThreads"]["nodes"] if not t["isResolved"]]
if ab:
    print(json.dumps({"pr":int(sys.argv[1]),"url":p["url"],"titulo":p["title"],"abertas":len(ab),
      "threads":[{"arquivo":t["path"],"autor":(t["comments"]["nodes"][0]["author"] or {}).get("login") if t["comments"]["nodes"] else None,
                  "trecho":(t["comments"]["nodes"][0]["body"][:160] if t["comments"]["nodes"] else "")} for t in ab]},ensure_ascii=False))
' "$pr")
  if [ -n "$item" ]; then
    [ $primeiro -eq 1 ] || saida="$saida,"
    saida="$saida$item"; primeiro=0
  fi
done
echo "$saida]"
