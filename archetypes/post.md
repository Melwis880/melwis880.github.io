---
{{- $tr := eq .Site.Language.Lang "tr" }}
title: "{{ replace .File.ContentBaseName "-" " " | strings.FirstUpper }}"
subtitle: ""
description: ""
date: {{ now.Format "2006-01-02" }}
# Tür (tek değer): case-study | field-note | research. Ayrıntı: WRITING.md
categories: ["field-note"]
# ASCII etiketler: n8n, python, ai-agents, automation ...
tags: []
# Sadece doğruysa aç: edit (YZ düzeltti) | draft (YZ taslağı yazdı, ben düzelttim)
# ai_use: edit
draft: true
---
{{ if $tr -}}
TODO: Bir iki cümle: hangi sorunla, nerede karşılaştım. Okur kendini burada tanımalı.

## Sorun

TODO: Elle nasıl yapılıyordu, neden yetmiyordu. Somut ol: kim, ne kadar sürüyordu, neyi bozuyordu.

<!--more-->

## Ne yaptım

TODO: Nasıl çalışıyor. Araçlar, kararlar ve neden onları seçtiğim. Kod gerekiyorsa kısa bir parça.

## Sonuç

TODO: Ölçülmüş sonuçlar (sayılar Projeler sayfasındakiyle aynı). Ölçülmeyeni sayı gibi yazma;
"henüz ölçülmedi" de.
{{- else -}}
TODO: One or two sentences: the problem I ran into and where. The reader should recognize it here.

## The problem

TODO: How it was done by hand and why that was not enough. Be concrete: who, how long, what broke.

<!--more-->

## What I did

TODO: How it works. Tools, decisions and why I picked them. A short code sample if it helps.

## The result

TODO: Measured results (numbers identical to the Projects page). Do not write something unmeasured
as a number; say "not measured yet".
{{- end }}
