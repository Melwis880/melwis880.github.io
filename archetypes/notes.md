---
{{- $tr := eq .Site.Language.Lang "tr" }}
title: "{{ replace .File.ContentBaseName "-" " " | strings.FirstUpper }}"
date: {{ now.Format "2006-01-02" }}
# Türü bölümden gelir (Not); kategori yazılmaz. ASCII etiketler: n8n, python, ai-agents ...
tags: []
# Sadece doğruysa aç: edit | draft
# ai_use: edit
draft: true
---
{{ if $tr -}}
TODO: Tek bir şey öğrendim: ne olduğu, bir iki cümle.

TODO: Nasıl yapılır: komut, ayar ya da kısa kod.

TODO: Nereden öğrendim (link) ve nerede işime yaradı.
{{- else -}}
TODO: One thing I learned: what it is, in a sentence or two.

TODO: How to do it: the command, setting or a short code sample.

TODO: Where I learned it (link) and where it helped.
{{- end }}
