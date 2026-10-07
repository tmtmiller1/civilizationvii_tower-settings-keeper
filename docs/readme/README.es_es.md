# Tower Settings Keeper

Un mod para Civilization VII. Con él instalado, las opciones que configuras en otros mods siguen configuradas después de reiniciar el juego. No tiene opciones propias y no cambia nada de la partida.

## El problema

Los mods guardan su configuración en el `localStorage` del juego. En Civilization VII 1.5.0 ese almacén tiene un fallo. Una lectura devuelve la primera entrada del almacén sin importar qué entrada se pidió, y no hay forma de listar las entradas. Un mod solo puede leer su propia configuración si su entrada resulta ser la primera. Cualquier otro mod recibe los datos de otro mod, los trata como propios y los vuelve a escribir con su propio nombre la próxima vez que guarda.

Los jugadores ven paneles de opciones que se reinician entre sesiones y, a veces, la configuración de un mod aparece dentro de otro.

La mayoría de los paneles de opciones comparten una entrada llamada `modSettings`, con una sección por mod. Unos cincuenta mods del Workshop incluyen además una rutina que borra todo el almacén en cuanto ve una segunda entrada. Basta un mod que guarde su configuración en una entrada propia para borrar la configuración de todos los demás en el siguiente guardado.

## Qué hace el mod

Mantiene todas las entradas dentro de la única fila que el juego puede leer y responde a todas las llamadas a `localStorage` desde esa fila.

- Un mod que usa su propia clave la ve guardada y leída con esa clave.
- La entrada compartida `modSettings` funciona como antes, con una sección por mod, así que los paneles de opciones existentes no necesitan cambios.
- El almacén siempre indica una sola entrada, por lo que la rutina de borrado nunca se ejecuta.
- Si otro mod ya ha desordenado el almacén, el mod coloca en su sitio las entradas que puede identificar y deja el resto sin tocar. Lo vuelve a comprobar en cada inicio.

Los demás mods no necesitan actualizaciones. Funciona con los mods que ya están en el Workshop.

## Funciona con todos los mods, sin cambios

Este mod resuelve el problema para todos los mods que guardan configuración, tal como son hoy. Los autores de mods no tienen que cambiar nada ni registrar nada. Un jugador que instala este mod obtiene de una vez una configuración que funciona en todos sus mods.

Los autores de mods tienen una opción adicional. Pueden incluir el mismo archivo dentro de su propio mod, para que sus jugadores estén cubiertos aunque nunca instalen este mod. Se explica más abajo, en «Para autores de mods». Un mod que incluye el archivo y este mod pueden estar instalados a la vez. Solo se ejecuta una copia, la más reciente, y las demás no hacen nada.

## Capturas de pantalla

Opciones cambiadas en el menú principal y leídas de nuevo en la pantalla de opciones tras un reinicio:

| Antes | Después del cambio | Tras un reinicio |
|---|---|---|
| ![](../images/1-menu-before.png) | ![](../images/1-menu-after.png) | ![](../images/2-menu-persisted.png) |

Opciones cambiadas durante una partida y leídas de nuevo tras otro reinicio, en el menú y en la partida:

| En la partida, antes | En la partida, después | Menú, tras un reinicio | Partida, tras un reinicio |
|---|---|---|---|
| ![](../images/3-ingame-before.png) | ![](../images/3-ingame-after.png) | ![](../images/4-menu-after-game.png) | ![](../images/5-ingame-persisted.png) |

Los demás mods usan los valores guardados, no solo los muestran. La opción «Commander lens activation» de Map Trix se puso en «Military and Recon Units» y se guardó. En un proceso nuevo, seleccionar un explorador activa su lente de comandante, cosa que no ocurre con el valor por defecto:

![](../images/lens-persisted-scout.png)

Probado en 1.5.0 con 28 mods, entre ellos Map Trix, City Hall, Celebratory Celebrations, Wonders Screen Continued, Better Ribbon Info, Compact Policy Cards, History and Rankings, un gestor de configuración y AutoMissionary. El registro completo está en [docs/design.md](../design.md) (en inglés).

## Instalación

Suscríbete en el Steam Workshop, o descarga el zip de la última versión y descomprímelo en `~/Library/Application Support/Civilization VII/Mods/` (macOS) o `%LOCALAPPDATA%\Firaxis Games\Sid Meier's Civilization VII\Mods\` (Windows). Después actívalo en «Contenido adicional». No hay nada que configurar.

## Cosas que conviene saber

- La configuración que guardes a partir de ahora se conserva. La que se perdió antes de instalar el mod ya no está, salvo que siga en el disco bajo una entrada que el mod pueda identificar.
- Si el almacén ya estaba roto, el mod no adivina qué mod escribió una entrada que no puede identificar. Si esa entrada es la única que queda, el mod reconstruye el almacén a su alrededor y conserva su contenido. El nombre de la entrada se pierde. Una versión posterior que reconozca el contenido lo devolverá a su nombre correcto. Si hay dos o más entradas de ese tipo por delante, el mod crea una raíz nueva delante de ellas, las deja en el disco y lo intenta de nuevo en el siguiente inicio. Nunca sobrescribe los datos de otro mod.
- El juego no garantiza el orden en que se ejecutan los scripts de los mods. Un mod que lee su configuración en el momento en que se carga su script, antes de que este mod se haya ejecutado, ve el comportamiento antiguo durante ese único inicio. En todos los inicios de prueba hasta ahora este mod se ejecutó primero.
- Los textos propios del mod están traducidos a los once idiomas que admite el juego.
- El almacén tiene un límite de tamaño de 4 MB. Es ocho veces los 0,5 MB que ocupa un almacén con 28 mods. Un mod que intente superarlo ve rechazada esa única escritura y conserva sus ajustes anteriores, y en Opciones, Complementos aparece una fila "Límite de almacenamiento alcanzado" que nombra al mod. Nada más se ve afectado. Véase "Carga y límites" más abajo.
- No aparece nada en pantalla, aparte de una línea en `Logs/UI.log` que empieza por `[settings-keeper] ready:`. La excepción es el caso de reserva descrito arriba. Entonces «Opciones, Complementos» muestra una fila «Reconstruir almacenamiento». Púlsala, confirma, y las entradas que el mod no pudo identificar se borran y el almacén se vuelve a escribir como una sola entrada. La fila desaparece cuando el almacén vuelve a ser normal.

  | La fila, solo cuando hace falta | La confirmación |
  |---|---|
  | ![](../images/rebuild-row.png) | ![](../images/rebuild-dialog.png) |

## Carga y límites

Todo vive en una sola fila, así que el tamaño de esa fila es lo que hay que vigilar. Con 28 mods instalados, la fila en la máquina de pruebas ocupa unos 0,5 MB, casi todo el historial de partidas de un solo mod. Un panel de opciones añade unos cientos de bytes. Una escritura serializa la fila entera, unos 8 ms a ese tamaño, una vez por tarea sin importar cuántos valores se escriban en ella. El número de mods no importa por sí solo. Lo que importa es cuánto almacenan.

Para encontrar dónde se rinde el motor, una sonda hizo crecer la fila de 1 en 1 MB a través del mod en una partida de Jugar ahora con los mismos 28 mods, y lanzamientos separados probaron las piezas por separado.

| Tamaño de la fila | Una escritura (serializar y guardar) | Lectura de una clave tras una escritura |
|---|---|---|
| 0,5 MB, el almacén real | 8 ms | 2 ms |
| 5 MB | 71 ms | 20 ms |
| 10 MB | 101 ms | 64 ms |
| 13 MB | 141 ms | 67 ms |
| 16 MB en una sola escritura | 102 ms | |
| 20 MB, creciendo de 1 en 1 MB | 197 ms | |

No se perdió ni se corrompió nada a ningún tamaño, y el almacén siguió siendo una sola fila. El proceso del juego sí tiene un techo. Se detuvo, sin informe de fallo, en el paso de 14 MB cuando la fila se leía y reescribía varias veces seguidas, y en el paso de 21 MB cuando solo se reescribía. Un almacén de 14 MB cargó en el menú principal y en una partida con todas las claves legibles, y se detuvo cuando la fila se volvió a leer y reescribir una vez más. El proceso estaba en 1,9 GB al detenerse, así que el techo es la memoria del juego, no el almacenamiento.

Por eso el mod rechaza cualquier escritura que lleve la fila más allá de 4 MB, una cuarta parte del tamaño más bajo al que se detuvo el juego. La escritura rechazada lanza el mismo `QuotaExceededError` que lanza un navegador cuando su localStorage está lleno, así que un mod escrito para la API web ya sabe qué significa. El valor anterior del mod se conserva, los demás mods no se tocan, el registro nombra al mod y los tamaños, y Opciones, Complementos muestra una fila "Límite de almacenamiento alcanzado" con los mismos datos y un Aceptar que la quita. El límite es una constante al principio de `ui/settings-keeper.js`.

## Quitar el mod

Normalmente no hay que hacer nada. El almacén es una sola fila, así que el juego lee primero `modSettings` como antes, y los demás mods encuentran sus secciones. Lo único añadido son unos campos internos que ignoran. Si «Opciones» muestra la fila «Reconstruir almacenamiento», púlsala antes de desactivar el mod. Si no, la rutina de borrado de otros mods vaciará el almacén en el siguiente guardado.

## Para autores de mods

No se te exige nada. La configuración de tu mod funciona con este mod instalado, tanto si tu mod usa la entrada compartida `modSettings` como si usa su propia clave.

Si quieres que tus jugadores estén cubiertos sin instalar este mod, puedes incluir la corrección dentro de tu propio mod. Es un archivo y dos líneas en tu modinfo, y tu código de configuración no cambia. Las instrucciones están en [embed/README.md](../../embed/README.md) (en inglés), o descarga `settings-keeper-embed-<versión>.zip` de la última versión.

## Licencia

MIT.
