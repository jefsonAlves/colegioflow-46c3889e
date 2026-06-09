
## O que muda

Dentro do detalhe da turma (modal em `src/routes/app.turmas.tsx`), dois novos recursos:

### 1. Adicionar vários alunos de uma vez
- Trocar o `Input` único de "Nome do aluno" por um `Textarea` que aceita uma lista (um nome por linha; também aceita separação por vírgula ou ponto-e-vírgula).
- Botão **"Adicionar alunos"**:
  - Divide o texto, faz `trim`, remove vazios, remove duplicados (comparando case-insensitive entre si e contra alunos já existentes da turma).
  - Ordena alfabeticamente (pt-BR, `localeCompare` com `sensitivity: "base"`).
  - Insere todos via uma única chamada `supabase.from("students").insert([...])` (mais rápido que um por um).
  - Mostra toast com o total inserido e quantos foram ignorados por já existirem.
- A lista de alunos exibida no modal continua usando a numeração existente (1, 2, 3...) — a ordenação alfabética virá naturalmente porque `listStudentsByClass` já faz `.order("name")`.
- Mantém o input rápido de "um por um" como atalho? **Não** — o `Textarea` cobre os dois casos (digitar 1 nome também funciona). Simplifica a UI.

### 2. Transferir aluno de turma
- Em cada linha de aluno na lista do modal, adicionar um botão de menu (ícone `MoreVertical`) com:
  - **Transferir de turma** → abre um pequeno diálogo (`Dialog` shadcn) com um `<select>` listando as outras turmas da escola. Confirma e chama `updateStudent(schoolId, studentId, { classId: novaTurma })` (função já existe em `src/lib/students.ts`).
  - Após sucesso: `toast.success`, invalida `["students", schoolId, cls.id]` e `["students", schoolId, novaTurma]`.
- RLS atual já permite a edição pelos membros da escola (mesma política dos outros updates).

## Arquivos afetados

- `src/routes/app.turmas.tsx` — trocar input por textarea, função de bulk insert + ordenação, menu de ações por aluno, diálogo de transferência.
- (opcional) `src/lib/students.ts` — adicionar helper `createStudentsBulk(schoolId, classId, names[])` para encapsular o insert em lote. Recomendo criar para manter o componente enxuto.

## Fora de escopo

- Importar de planilha/CSV (o textarea cobre o caso de colar de uma planilha — cada linha vira um aluno).
- Edição em lote de outros campos (responsável, telefone).
- Mudanças no `AppShell`, RLS, ou backend além do helper opcional.
