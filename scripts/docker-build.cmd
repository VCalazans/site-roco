@echo off
REM Build da imagem site-roco no Windows.
REM
REM Por que tar via stdin? O BuildKit no Windows falha ao transferir contexto com
REM caminhos contendo colchetes/parenteses ("invalid file request
REM src/app/[locale]/(site)/page.tsx"). Enviar o contexto como tarball via stdin
REM contorna o bug. Rode da raiz do projeto:
REM   scripts\docker-build.cmd
REM Depois: docker compose up -d --no-build web
REM
REM Nota: cmd faz pipe binario com seguranca (PowerShell 5 corrompe streams binarios).

cd /d "%~dp0.."
REM Passa build-args de ambiente: R2_PUBLIC_URL e R2_ACCOUNT_ID são opcionais.
REM Se não definidas, a build funciona (remotePatterns fica vazio, sem R2 no CSP).
tar -cf - --exclude=node_modules --exclude=.next --exclude=.git --exclude=.github --exclude=.claude --exclude=memory-bank --exclude=docs --exclude=*.md --exclude=.env --exclude=.env.local --exclude=.dockerignore . | docker build -t site-roco:latest --build-arg NEXT_PUBLIC_MAUTIC_TRACKING_ENABLED=false --build-arg NEXT_PUBLIC_SITE_URL=http://localhost:3000 --build-arg R2_PUBLIC_URL=%R2_PUBLIC_URL% --build-arg R2_ACCOUNT_ID=%R2_ACCOUNT_ID% -
