# Plano: Implementação de Eventualidades

Adicionar uma nova funcionalidade chamada "Eventualidades" no painel inicial do Klassio. Esta ferramenta permitirá que professores e administradores criem listas de verificação, registros de notas rápidas ou controles de recebimento para turmas específicas, com suporte a prazos e diferentes tipos de marcação.

## O que será construído

### 1. Banco de Dados e API
- **Nova Tabela `eventualities`**:
  - `id`, `school_id`, `class_id`, `teacher_id`, `title`, `description`.
  - `event_type`: tipo do registro (`boolean`, `numeric`, `status`, `custom`).
  - `deadline`: data opcional de prazo.
  - `status`: `open`, `closed`.
  - `created_at`, `updated_at`.
- **Nova Tabela `eventuality_records`**:
  - `id`, `eventuality_id`, `student_id`, `value` (JsonB para suportar texto, número ou boolean), `marked_at`.
- **Biblioteca `src/lib/eventualities.ts`**:
  - Funções CRUD para gerenciar eventualidades e seus registros.

### 2. Interface do Usuário (UI)
- **Atalho no Início**: Adicionar o card "Eventualidades" na `src/routes/app.index.tsx`.
- **Nova Rota `src/routes/app.eventualidades.tsx`**:
  - Tela principal listando eventos ativos e opção para criar novo.
  - Seletor de turma para novos eventos.
  - Configuração de prazo ("Hoje", "Com prazo", "Sem prazo").
  - Configuração do tipo de marcação (Certo/Errado, Nota, Check de Recebido, Personalizado).
- **Tela de Preenchimento (Formato Planilha)**:
  - Interface tabular com a lista de alunos da turma.
  - Coluna para marcação baseada no tipo escolhido.
  - Opção de salvar/atualizar registros.
  - Opção de excluir o evento.

### 3. Melhorias e Regras de Negócio
- **Persistência**: Dados salvos no banco para consulta futura e backup.
- **Flexibilidade**: Possibilidade de encerrar ou apagar o evento a qualquer momento.
- **Aviso de Dados não Salvos**: Integração com o sistema de detecção de alterações pendentes.

## Detalhes Técnicos
- Utilização de `createServerFn` para operações no banco de dados.
- RLS policies para garantir que professores vejam suas turmas e administradores vejam toda a escola.
- Ícone sugerido: `CalendarPlus` ou `ListTodo` da Lucide.

## Próximos Passos
1. Criar migração SQL para as tabelas `eventualities` e `eventuality_records`.
2. Implementar a lógica de dados em `src/lib/eventualities.ts`.
3. Criar a tela `src/routes/app.eventualidades.tsx`.
4. Adicionar o card na Home.
