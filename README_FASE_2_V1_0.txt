PROJETO EDUCACIONAL 7.0 — FASE 2 — VERSÃO 1.0
Rótulo exibido na interface: Projeto Educacional 2.0

ARQUIVOS PRINCIPAIS
- index.html
- style.css
- script.js

BASE FUNCIONAL
Esta versão parte da VERSÃO FINAL FASE1 e mantém a mesma chave local de dados:
localStorage: projetoEducacional7
sessionStorage: projetoEducacional7Session

Assim, quando publicada no mesmo domínio/origem da FASE 1, a FASE 2 reutiliza os dados locais já existentes no navegador: professores, turmas, alunos, atividades, liberações, submissões e relatórios.

FASE 2 — EXPERIÊNCIA DO ALUNO
- Tela de escolha de dificuldade com três percursos sempre visíveis:
  Básico — Natureza
  Intermediário — Antártica
  Avançado — Vulcão
- Mapa de missões em blocos de 5: 01–05, 06–10, 11–15.
- Estados: concluída, em andamento, disponível e bloqueada.
- Transição para o próximo bloco após a conclusão do trecho anterior.
- Painel da sua participação com três ícones, um por nível.
- Relatório individual em DOCX por bloco ou pelo nível completo.
- O aluno vê apenas os próprios dados; o histórico pedagógico detalhado permanece exclusivo do professor.

IMAGENS DOS CENÁRIOS — COLOCAR NA RAIZ DO GITHUB
B15natureza.jpg
B610natureza.jpg
B1115natureza.jpg
I15antartica.jpg
I610antartica.jpg
I1115antartica.jpg
A15vulcao.jpg
A610vulcao.jpg
A1115vulcao.jpg

FUNCIONALIDADES PRESERVADAS DA FASE 1
- Área do professor e menu global.
- Minhas Turmas e observações pedagógicas.
- Banco de atividades e upload.
- Liberação para uma, várias ou todas as turmas.
- Participação com filtros e situação do aluno: Ativo, Remanejando, Desistente.
- Relatório XLSX do professor.
- Material Dourado para atividades de Divisão.
- Material Dourado em tela cheia, trocas, distribuição, histórico de movimentações e salvamento do progresso.
- Campo de rascunho com histórico de versões.
- Bloqueio de copiar, colar, recortar, Ctrl+C, Ctrl+V, Ctrl+X, botão direito e arrastar/soltar no rascunho.
- Histórico detalhado de rascunho e Material Dourado acessível na área do professor.

ACESSO DO ALUNO
- Entrar em perfil existente.
- Criar perfil / primeiro acesso.
- Acesso direto sem criar perfil para experimentar o jogo.

OBSERVAÇÃO SOBRE ACESSO DIRETO
O acesso direto não fica vinculado a uma turma ou perfil. Ele serve para experimentar as atividades do banco do sistema disponíveis nesta versão. Para acompanhamento pedagógico permanente, o estudante deve usar um perfil de aluno.

BACKEND
Esta versão continua local, sem Supabase. Nenhuma chave secreta ou referência ao Supabase foi incluída no código.
