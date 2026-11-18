# Rio Zero

Jogo 3D em three.js para a disciplina de Computação Gráfica (UNIFESP): ação com apocalipse zumbi no Rio de Janeiro.

## Como rodar

O projeto usa módulos ES. Por isso, precisa ser aberto por um servidor local:

```bash
python -m http.server 8000
```

Depois, abra `http://localhost:8000` e clique em **Jogar**. Os controles aparecem no menu; a tecla **H** abre o modo apresentação, com as câmeras, luzes e texturas das entregas anteriores.

## Entregas

- **Entrega 1:** modelagem dos personagens, cenário e configurações de câmera.
- **Entrega 2:** câmeras, projeção perspectiva e iluminação. O relatório está em [relatorio/entrega-2.md](relatorio/entrega-2.md) e em PDF, em [relatorio/entrega-2.pdf](relatorio/entrega-2.pdf).
- **Entrega 3:** texturas e mapeamento UV, e o começo do combate. O relatório está em [relatorio/entrega-3.md](relatorio/entrega-3.md) e em PDF, em [relatorio/entrega-3.pdf](relatorio/entrega-3.pdf).
- **Entrega 4:** jogabilidade, interação e pontuação. A fase 1 completa em primeira pessoa: besta e pistola, pular, deslizar para desviar, recolher virotes, três ondas com ninhos, pontos com combo e telas de vitória e derrota. O relatório (que também explica a mudança de direcionamento do jogo) está em [relatorio/entrega-4.md](relatorio/entrega-4.md) e em PDF, em [relatorio/entrega-4.pdf](relatorio/entrega-4.pdf).

## Texturas

As imagens de `texturas/` são desenhadas pelo script `ferramentas/gerar_texturas.py` (Python, com numpy e Pillow). Para gerar de novo:

```bash
python ferramentas/gerar_texturas.py
```
