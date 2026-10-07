# Tower Settings Keeper

Un mod pour Civilization VII. Une fois installé, les options que vous réglez dans d'autres mods restent réglées après un redémarrage du jeu. Il n'a aucune option propre et ne change rien à la partie.

## Le problème

Les mods conservent leurs réglages dans le `localStorage` du jeu. Dans Civilization VII 1.5.0, ce stockage a un bug. Une lecture renvoie la première entrée du stockage, quelle que soit l'entrée demandée, et il n'existe aucun moyen de lister les entrées. Un mod ne peut relire ses propres réglages que si son entrée se trouve être la première. Tout autre mod reçoit les données d'un autre mod, les prend pour les siennes et les réécrit sous son propre nom à la sauvegarde suivante.

Les joueurs voient des panneaux d'options qui se réinitialisent d'un lancement à l'autre, et parfois les réglages d'un mod apparaissent dans un autre.

La plupart des panneaux d'options partagent une entrée nommée `modSettings`, avec une section par mod. Une cinquantaine de mods du Workshop contiennent en plus une routine qui efface tout le stockage dès qu'elle voit une deuxième entrée. Un seul mod qui range ses réglages sous sa propre entrée suffit à effacer les réglages de tous les autres à la sauvegarde suivante.

## Ce que fait le mod

Il garde chaque entrée dans la seule ligne que le jeu sait lire et répond à chaque appel à `localStorage` à partir de cette ligne.

- Un mod qui utilise sa propre clé la voit stockée et relue sous cette clé.
- L'entrée partagée `modSettings` fonctionne comme avant, une section par mod, si bien que les panneaux d'options existants n'ont besoin d'aucune modification.
- Le stockage annonce toujours une seule entrée, donc la routine d'effacement ne se déclenche jamais.
- Si un autre mod a déjà mis le stockage en désordre, le mod remet à leur place les entrées qu'il sait identifier et laisse le reste tel quel. Il vérifie à nouveau à chaque lancement.

Les autres mods n'ont pas besoin de mise à jour. Il fonctionne avec les mods déjà présents sur le Workshop.

## Fonctionne avec tous les mods, sans modification

Ce mod corrige le problème pour tous les mods qui enregistrent des réglages, tels qu'ils sont aujourd'hui. Les auteurs de mods n'ont rien à changer ni à déclarer. Un joueur qui installe ce mod obtient d'un coup des réglages qui fonctionnent dans tous ses mods.

Les auteurs de mods ont une option supplémentaire. Ils peuvent livrer le même fichier dans leur propre mod, afin que leurs joueurs soient couverts même s'ils n'installent jamais ce mod. C'est décrit plus bas sous « Pour les auteurs de mods ». Un mod qui livre le fichier et ce mod peuvent être installés ensemble. Une seule copie s'exécute, la plus récente, et les autres ne font rien.

## Captures d'écran

Options modifiées dans le menu principal, puis relues dans l'écran des options après un redémarrage :

| Avant | Après la modification | Après un redémarrage |
|---|---|---|
| ![](../images/1-menu-before.png) | ![](../images/1-menu-after.png) | ![](../images/2-menu-persisted.png) |

Options modifiées pendant une partie, puis relues après un autre redémarrage, dans le menu et en partie :

| En partie, avant | En partie, après | Menu, après un redémarrage | Partie, après un redémarrage |
|---|---|---|---|
| ![](../images/3-ingame-before.png) | ![](../images/3-ingame-after.png) | ![](../images/4-menu-after-game.png) | ![](../images/5-ingame-persisted.png) |

Les autres mods utilisent les valeurs enregistrées, ils ne se contentent pas de les afficher. L'option « Commander lens activation » de Map Trix a été réglée sur « Military and Recon Units » et enregistrée. Dans un nouveau processus, sélectionner un éclaireur active sa loupe de commandant, ce qui ne se produit pas avec le réglage par défaut :

![](../images/lens-persisted-scout.png)

Testé sur la 1.5.0 avec 28 mods, dont Map Trix, City Hall, Celebratory Celebrations, Wonders Screen Continued, Better Ribbon Info, Compact Policy Cards, History and Rankings, un gestionnaire de réglages et AutoMissionary. Le compte rendu complet se trouve dans [docs/design.md](../design.md) (en anglais).

## Installation

Abonnez-vous sur le Steam Workshop, ou téléchargez le zip de la dernière version et décompressez-le dans `~/Library/Application Support/Civilization VII/Mods/` (macOS) ou `%LOCALAPPDATA%\Firaxis Games\Sid Meier's Civilization VII\Mods\` (Windows). Activez-le ensuite dans « Contenu additionnel ». Il n'y a rien à configurer.

## Bon à savoir

- Les réglages que vous enregistrez à partir de maintenant sont conservés. Ceux qui ont été perdus avant l'installation du mod sont perdus, sauf s'ils sont encore sur le disque sous une entrée que le mod sait identifier.
- Si le stockage était déjà abîmé, le mod ne devine pas quel mod a écrit une entrée qu'il ne sait pas identifier. Si cette entrée est la seule qui reste, le mod reconstruit le stockage autour d'elle et en conserve le contenu. Le nom de l'entrée est perdu. Une version ultérieure qui reconnaît le contenu le remettra sous le bon nom. Si deux entrées de ce genre ou plus sont en travers, le mod crée une nouvelle racine devant elles, les laisse sur le disque et réessaie au lancement suivant. Il n'écrase jamais les données d'un autre mod.
- Le jeu ne garantit pas l'ordre d'exécution des scripts des mods. Un mod qui lit ses réglages au moment où son script se charge, avant que ce mod ne se soit exécuté, voit l'ancien comportement pour ce seul lancement. Dans tous les lancements de test effectués jusqu'ici, ce mod s'est exécuté en premier.
- Les textes du mod sont traduits dans les onze langues prises en charge par le jeu.
- Le stockage a une limite de taille de 4 Mo. C'est huit fois les 0,5 Mo qu'occupe un stockage avec 28 mods. Un mod qui tente de la dépasser voit cette seule écriture refusée et garde ses réglages précédents, et Options, Modules affiche une ligne « Limite de stockage atteinte » qui nomme le mod. Rien d'autre n'est touché. Voir « Charge et limites » plus bas.
- Rien n'apparaît à l'écran, à part une ligne dans `Logs/UI.log` qui commence par `[settings-keeper] ready:`. L'exception est le cas de secours décrit ci-dessus. « Options, Add-ons » affiche alors une ligne « Reconstruire le stockage ». Appuyez dessus, confirmez, et les entrées que le mod n'a pas pu identifier sont supprimées et le stockage est réécrit en une seule entrée. La ligne disparaît une fois le stockage redevenu normal.

  | La ligne, seulement quand c'est nécessaire | La confirmation |
  |---|---|
  | ![](../images/rebuild-row.png) | ![](../images/rebuild-dialog.png) |

## Charge et limites

Tout tient dans une seule ligne, c'est donc la taille de cette ligne qu'il faut surveiller. Avec 28 mods installés, la ligne sur la machine de test fait environ 0,5 Mo, presque entièrement l'historique de parties d'un seul mod. Un panneau d'options ajoute quelques centaines d'octets. Une écriture sérialise toute la ligne, environ 8 ms à cette taille, une fois par tâche quel que soit le nombre de valeurs écrites. Le nombre de mods ne compte pas en soi. Ce qui compte, c'est ce qu'ils stockent.

Pour trouver où le moteur lâche, une sonde a fait grossir la ligne de 1 Mo à la fois à travers le mod dans une partie Jouer avec les mêmes 28 mods, et des lancements séparés ont essayé chaque morceau à part.

| Taille de la ligne | Une écriture (sérialiser et stocker) | Lecture d'une clé après une écriture |
|---|---|---|
| 0,5 Mo, le stockage réel | 8 ms | 2 ms |
| 5 MB | 71 ms | 20 ms |
| 10 MB | 101 ms | 64 ms |
| 13 MB | 141 ms | 67 ms |
| 16 Mo en une seule écriture | 102 ms | |
| 20 Mo, par pas de 1 Mo | 197 ms | |

Rien n'a été perdu ni corrompu à aucune taille, et le stockage est resté une seule ligne. Le processus du jeu, lui, a un plafond. Il s'est arrêté, sans rapport de plantage, au palier de 14 Mo quand la ligne était lue et réécrite plusieurs fois de suite, et au palier de 21 Mo quand elle était seulement réécrite. Un stockage de 14 Mo s'est chargé au menu principal et en partie avec toutes les clés lisibles, puis s'est arrêté quand la ligne a été relue et réécrite une fois de plus. Le processus était à 1,9 Go à l'arrêt : le plafond est la mémoire du jeu, pas le stockage.

Le mod refuse donc toute écriture qui porterait la ligne au-delà de 4 Mo, un quart de la plus petite taille à laquelle le jeu s'est arrêté. L'écriture refusée lève le même `QuotaExceededError` qu'un navigateur quand son localStorage est plein, qu'un mod écrit pour l'API web connaît déjà. La valeur précédente du mod reste, les autres mods ne sont pas touchés, le journal nomme le mod et les tailles, et Options, Modules affiche une ligne « Limite de stockage atteinte » avec les mêmes détails et un OK qui l'efface. La limite est une constante en tête de `ui/settings-keeper.js`.

## Retirer le mod

En général, il n'y a rien à faire. Le stockage tient en une ligne, donc le jeu lit d'abord `modSettings` comme avant, et les autres mods retrouvent leurs sections. Le seul ajout est une poignée de champs internes qu'ils ignorent. Si « Options » affiche la ligne « Reconstruire le stockage », appuyez dessus avant de désactiver le mod. Sinon, la routine d'effacement des autres mods videra le stockage à la sauvegarde suivante.

## Pour les auteurs de mods

Rien ne vous est demandé. Les réglages de votre mod fonctionnent avec ce mod installé, que votre mod utilise l'entrée partagée `modSettings` ou sa propre clé.

Si vous voulez que vos joueurs soient couverts sans installer ce mod, vous pouvez livrer le correctif dans votre propre mod. C'est un fichier et deux lignes dans votre modinfo, et votre code de réglages ne change pas. Les instructions sont dans [embed/README.md](../../embed/README.md) (en anglais), ou prenez `settings-keeper-embed-<version>.zip` dans la dernière version.

## Licence

MIT.
