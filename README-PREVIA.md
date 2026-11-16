# Prévia — categoria “Outros materiais”

Cópia de trabalho separada do projeto AçoGestão. O site publicado não foi alterado.

O menu do estoque adiciona “Outros materiais” depois de “Arames”. A janela de lançamento contém:
- Nome do material obrigatório.
- Quantidade opcional.
- Kg por unidade opcional.
- Validação: quantidade, kg por unidade ou ambos devem ser preenchidos; não pode salvar com os dois vazios. Valores preenchidos devem ser maiores que zero.
- Quando quantidade e kg por unidade estiverem preenchidos, calcula e exibe o peso total; ele também fica registrado no lançamento.
- Nota Fiscal opcional no formulário (mesmo campo de NF das demais categorias), exibida na tabela e na exportação CSV.
- Tabela própria da categoria, resumo consolidado, busca, edição e exclusão; o peso calculado integra o total consolidado.
- Regras Firestore da cópia atualizadas, para exigir o nome e ao menos um dos dois valores.

Unidades e peso ficam separados quando só um dos campos é preenchido. “Peso total” só é calculado quando a quantidade e o kg/unidade são fornecidos.

Antes de usar a categoria no site publicado, será necessário aplicar também as regras Firestore incluídas nesta cópia, pois as regras atuais não conhecem a nova categoria.


## Revisão técnica

- Checagens estáticas de integração dos campos, validações, Firestore, tabela, busca, CSV e resumo concluídas.
- Testes de lógica revisados para quantidade + kg/unidade, somente quantidade e somente kg/unidade.
- Não foi possível executar npm build/typecheck neste ambiente porque Node.js e npm não estão instalados.
