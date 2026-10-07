# Tower Settings Keeper

Um mod para Civilization VII. Com ele instalado, as opções que você define em outros mods continuam definidas depois de reiniciar o jogo. Ele não tem opções próprias e não muda a jogabilidade.

## O problema

Os mods guardam suas configurações no `localStorage` do jogo. No Civilization VII 1.5.0 esse armazenamento tem um defeito. Uma leitura devolve a primeira entrada do armazenamento, não importa qual entrada foi pedida, e não há como listar as entradas. Um mod só consegue ler suas próprias configurações se a entrada dele por acaso for a primeira. Todos os outros mods recebem os dados de outro mod, tratam esses dados como seus e os gravam de volta com o próprio nome na próxima vez que salvam.

Os jogadores veem painéis de opções que voltam ao padrão a cada abertura do jogo e, às vezes, as configurações de um mod aparecendo dentro de outro.

A maioria dos painéis de opções compartilha uma entrada chamada `modSettings`, com uma seção para cada mod. Cerca de cinquenta mods da Workshop também incluem uma rotina que apaga o armazenamento inteiro assim que vê uma segunda entrada. Basta um mod que guarde suas configurações numa entrada própria para apagar as configurações de todos os outros no próximo salvamento.

## O que o mod faz

Ele mantém todas as entradas dentro da única linha que o jogo consegue ler e responde a todas as chamadas de `localStorage` a partir dessa linha.

- Um mod que usa a própria chave tem essa chave gravada e lida de volta.
- A entrada compartilhada `modSettings` funciona como antes, uma seção por mod, então os painéis de opções existentes não precisam de mudanças.
- O armazenamento sempre informa uma única entrada, então a rotina de limpeza nunca roda.
- Se outro mod já bagunçou a ordem do armazenamento, o mod coloca no lugar as entradas que consegue identificar e deixa o resto como está. Ele confere de novo a cada abertura.

Os outros mods não precisam de atualização. Ele funciona com os mods que já estão na Workshop.

## Funciona com todos os mods, sem mudanças

Este mod corrige o problema para todos os mods que guardam configurações, do jeito que eles são hoje. Os autores de mods não precisam mudar nada nem registrar nada. Um jogador que instala este mod passa a ter configurações funcionando em todos os seus mods de uma vez.

Os autores de mods têm uma opção a mais. Eles podem incluir o mesmo arquivo dentro do próprio mod, para que seus jogadores fiquem cobertos mesmo sem nunca instalar este mod. Isso está descrito abaixo em "Para autores de mods". Um mod que inclui o arquivo e este mod podem ficar instalados juntos. Só uma cópia roda, a mais recente, e as outras não fazem nada.

## Capturas de tela

Opções alteradas no menu principal e lidas de volta na tela de opções depois de reiniciar:

| Antes | Depois da mudança | Depois de reiniciar |
|---|---|---|
| ![](../images/1-menu-before.png) | ![](../images/1-menu-after.png) | ![](../images/2-menu-persisted.png) |

Opções alteradas durante uma partida e lidas de volta depois de outro reinício, no menu e na partida:

| Na partida, antes | Na partida, depois | Menu, depois de reiniciar | Partida, depois de reiniciar |
|---|---|---|---|
| ![](../images/3-ingame-before.png) | ![](../images/3-ingame-after.png) | ![](../images/4-menu-after-game.png) | ![](../images/5-ingame-persisted.png) |

Os outros mods usam os valores salvos, não só os exibem. A opção "Commander lens activation" do Map Trix foi definida como "Military and Recon Units" e salva. Num processo novo, selecionar um batedor liga a lente de comandante, o que não acontece com o valor padrão:

![](../images/lens-persisted-scout.png)

Testado na 1.5.0 com 28 mods, entre eles Map Trix, City Hall, Celebratory Celebrations, Wonders Screen Continued, Better Ribbon Info, Compact Policy Cards, History and Rankings, um gerenciador de configurações e AutoMissionary. O registro completo está em [docs/design.md](../design.md) (em inglês).

## Instalação

Inscreva-se na Steam Workshop, ou baixe o zip da versão mais recente e descompacte-o em `~/Library/Application Support/Civilization VII/Mods/` (macOS) ou `%LOCALAPPDATA%\Firaxis Games\Sid Meier's Civilization VII\Mods\` (Windows). Depois, ative-o em "Conteúdo adicional". Não há nada para configurar.

## Bom saber

- As configurações salvas de agora em diante ficam. As que se perderam antes de instalar o mod já se foram, a menos que ainda estejam no disco numa entrada que o mod consiga identificar.
- Se o armazenamento já estava quebrado, o mod não adivinha qual mod gravou uma entrada que ele não consegue identificar. Se essa entrada for a única restante, o mod reconstrói o armazenamento em torno dela e mantém o conteúdo. O nome da entrada se perde. Uma versão posterior que reconheça o conteúdo o devolve ao nome certo. Se houver duas ou mais entradas assim no caminho, o mod cria uma raiz nova à frente delas, deixa-as no disco e tenta de novo na próxima abertura. Ele nunca sobrescreve os dados de outro mod.
- O jogo não garante a ordem em que os scripts dos mods rodam. Um mod que lê suas configurações no momento em que o script dele carrega, antes de este mod rodar, vê o comportamento antigo só naquela abertura. Em todas as aberturas de teste até agora, este mod rodou primeiro.
- Os textos do próprio mod estão traduzidos para todos os onze idiomas que o jogo aceita.
- O armazenamento tem um limite de tamanho de 4 MB. É oito vezes os 0,5 MB que um armazenamento com 28 mods ocupa. Um mod que tente passar disso tem essa única gravação recusada e mantém suas configurações anteriores, e Opções, Complementos mostra uma linha "Limite de armazenamento atingido" com o nome do mod. Nada mais é afetado. Veja "Carga e limites" abaixo.
- Nada aparece na tela, além de uma linha em `Logs/UI.log` que começa com `[settings-keeper] ready:`. A exceção é o caso reserva descrito acima. Nele, "Opções, Complementos" mostra uma linha "Reconstruir armazenamento". Pressione, confirme, e as entradas que o mod não conseguiu identificar são apagadas e o armazenamento é gravado de volta como uma única entrada. A linha some quando o armazenamento volta ao normal.

  | A linha, só quando necessário | A confirmação |
  |---|---|
  | ![](../images/rebuild-row.png) | ![](../images/rebuild-dialog.png) |

## Carga e limites

Tudo fica em uma só linha, então o tamanho dessa linha é o que importa observar. Com 28 mods instalados, a linha na máquina de teste tem cerca de 0,5 MB, quase tudo o histórico de partidas de um único mod. Um painel de opções acrescenta algumas centenas de bytes. Uma gravação serializa a linha inteira, cerca de 8 ms nesse tamanho, uma vez por tarefa, não importa quantos valores sejam gravados nela. O número de mods, por si só, não importa. O que importa é quanto eles guardam.

Para descobrir onde o motor desiste, uma sonda fez a linha crescer 1 MB por passo através do mod numa partida de Jogar agora com os mesmos 28 mods, e lançamentos separados testaram cada parte isoladamente.

| Tamanho da linha | Uma gravação (serializar e guardar) | Leitura de uma chave após uma gravação |
|---|---|---|
| 0,5 MB, o armazenamento real | 8 ms | 2 ms |
| 5 MB | 71 ms | 20 ms |
| 10 MB | 101 ms | 64 ms |
| 13 MB | 141 ms | 67 ms |
| 16 MB em uma só gravação | 102 ms | |
| 20 MB, crescendo 1 MB por vez | 197 ms | |

Nada se perdeu nem se corrompeu em tamanho nenhum, e o armazenamento continuou sendo uma só linha o tempo todo. O processo do jogo, esse tem um teto. Ele parou, sem relatório de falha, no passo de 14 MB quando a linha era lida e regravada várias vezes seguidas, e no passo de 21 MB quando era apenas regravada. Um armazenamento de 14 MB carregou no menu principal e numa partida com todas as chaves legíveis, e então parou quando a linha foi relida e regravada mais uma vez. O processo estava em 1,9 GB quando parou, então o teto é a memória do jogo, não o armazenamento.

Por isso o mod recusa qualquer gravação que leve a linha além de 4 MB, um quarto do menor tamanho em que o jogo parou. A gravação recusada lança o mesmo `QuotaExceededError` que um navegador lança quando seu localStorage está cheio, então um mod escrito para a API web já sabe o que isso significa. O valor anterior do mod fica, os outros mods não são tocados, o registro nomeia o mod e os tamanhos, e Opções, Complementos mostra uma linha "Limite de armazenamento atingido" com os mesmos detalhes e um OK que a remove. O limite é uma constante no início de `ui/settings-keeper.js`.

## Removendo o mod

Normalmente não há nada a fazer. O armazenamento é uma só linha, então o jogo lê `modSettings` primeiro como antes, e os outros mods encontram suas seções. O único acréscimo são alguns campos internos que eles ignoram. Se "Opções" mostrar a linha "Reconstruir armazenamento", pressione-a antes de desativar o mod. Caso contrário, a rotina de limpeza dos outros mods apagará o armazenamento no próximo salvamento.

## Para autores de mods

Nada é exigido de você. As configurações do seu mod funcionam com este mod instalado, quer o seu mod use a entrada compartilhada `modSettings`, quer use uma chave própria.

Se quiser que seus jogadores fiquem cobertos sem instalar este mod, você pode incluir a correção dentro do seu próprio mod. É um arquivo e duas linhas no seu modinfo, e o código de configurações continua como está. As instruções estão em [embed/README.md](../../embed/README.md) (em inglês), ou pegue `settings-keeper-embed-<versão>.zip` na versão mais recente.

## Licença

MIT.
