#!/usr/bin/env node

// Importações de módulos nativos e de terceiros
import { existsSync, readFileSync, writeFileSync } from 'node:fs' // Manipulação de arquivos
import { extname } from 'node:path' // Extensão de arquivos
import { parseArgs } from 'node:util' // Parsing de argumentos da linha de comando

import chalk from 'chalk' // Formatação de texto no terminal
import { watch } from 'chokidar' // Observador de mudanças em arquivos
import JSON5 from 'json5' // Suporte para arquivos JSON5
import { Adapter, Low } from 'lowdb' // Banco de dados leve
import { DataFile, JSONFile } from 'lowdb/node' // Adaptadores para lowdb
import { PackageJson } from 'type-fest' // Tipagem para arquivos package.json

import { fileURLToPath } from 'node:url' // Manipulação de URLs
import { createApp } from './app.js' // Função para criar a aplicação
import { Observer } from './observer.js' // Observador para o banco de dados
import { Data } from './service.js' // Tipos e funcionalidades relacionadas ao banco

// Função para exibir ajuda ao usuário
function help() {
  console.log(`Usage: json-server [options] <file>

Options:
  -p, --port <port>  Port (default: 3000)
  -h, --host <host>  Host (default: localhost)
  -s, --static <dir> Static files directory (multiple allowed)
  --help             Show this message
  --version          Show version number
`)
}

// Processa e valida os argumentos passados na linha de comando
function args() {
  try {
    const { values, positionals } = parseArgs({
      options: {
        port: { type: 'string', short: 'p', default: process.env['PORT'] ?? '3000' },
        host: { type: 'string', short: 'h', default: process.env['HOST'] ?? 'localhost' },
        static: { type: 'string', short: 's', multiple: true, default: [] },
        help: { type: 'boolean' },
        version: { type: 'boolean' },
        watch: { type: 'boolean', short: 'w' }, // Opção obsoleta
      },
      allowPositionals: true,
    })

    // Exibe a versão e encerra
    if (values.version) {
      const pkg = JSON.parse(
        readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf-8'),
      ) as PackageJson
      console.log(pkg.version)
      process.exit()
    }

    // Exibe ajuda e encerra
    if (values.help || positionals.length === 0) {
      help()
      process.exit()
    }

    return {
      file: positionals[0] ?? '',
      port: parseInt(values.port),
      host: values.host,
      static: values.static,
    }
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ERR_PARSE_ARGS_UNKNOWN_OPTION') {
      console.log(chalk.red((e as NodeJS.ErrnoException).message.split('.')[0]))
      help()
      process.exit(1)
    } else {
      throw e
    }
  }
}

// Obtém os argumentos
const { file, port, host, static: staticArr } = args()

// Verifica se o arquivo especificado existe
if (!existsSync(file)) {
  console.log(chalk.red(`File ${file} not found`))
  process.exit(1)
}

// Cria um arquivo vazio se o JSON especificado estiver vazio
if (readFileSync(file, 'utf-8').trim() === '') {
  writeFileSync(file, '{}')
}

// Configuração do banco de dados
let adapter: Adapter<Data>
if (extname(file) === '.json5') {
  adapter = new DataFile<Data>(file, { parse: JSON5.parse, stringify: JSON5.stringify }) // Suporte para JSON5
} else {
  adapter = new JSONFile<Data>(file) // Suporte para JSON padrão
}
const observer = new Observer(adapter) // Observador para mudanças no banco de dados
const db = new Low<Data>(observer, {}) // Instância do banco de dados
await db.read() // Carrega os dados do arquivo

// Cria o servidor usando os dados carregados
const app = createApp(db, { logger: false, static: staticArr })

// Exibe as rotas disponíveis no terminal
function logRoutes(data: Data) {
  console.log(chalk.bold('Endpoints:'))
  if (Object.keys(data).length === 0) {
    console.log(chalk.gray(`No endpoints found, try adding some data to ${file}`))
    return
  }
  console.log(
    Object.keys(data)
      .map((key) => `${chalk.gray(`http://${host}:${port}/`)}${chalk.blue(key)}`)
      .join('\n'),
  )
}

// Lista de kaomojis para personalizar a saída do terminal
const kaomojis = ['♡⸜(˶˃ ᵕ ˂˶)⸝♡', '♡( ◡‿◡ )', '( ˶ˆ ᗜ ˆ˵ )', '(˶ᵔ ᵕ ᵔ˶)']

// Retorna um item aleatório de uma lista
function randomItem(items: string[]): string {
  const index = Math.floor(Math.random() * items.length)
  return items.at(index) ?? ''
}

// Inicializa o servidor na porta especificada
app.listen(port, () => {
  console.log(
    [
      chalk.bold(`JSON Server started on PORT :${port}`),
      chalk.gray('Press CTRL-C to stop'),
      chalk.gray(`Watching ${file}...`),
      '',
      chalk.magenta(randomItem(kaomojis)), // Adiciona um kaomoji à saída
      '',
      chalk.bold('Index:'),
      chalk.gray(`http://localhost:${port}/`),
      '',
      chalk.bold('Static files:'),
      chalk.gray('Serving ./public directory if it exists'),
      '',
    ].join('\n'),
  )
  logRoutes(db.data)
})

// Observa mudanças no arquivo JSON em ambientes de desenvolvimento
if (process.env['NODE_ENV'] !== 'production') {
  let writing = false // Indica se o arquivo está sendo escrito pelo servidor
  let prevEndpoints = '' // Lista de endpoints antes de mudanças

  // Define os eventos de escrita/leitura do banco
  observer.onWriteStart = () => {
    writing = true
  }
  observer.onWriteEnd = () => {
    writing = false
  }
  observer.onReadStart = () => {
    prevEndpoints = JSON.stringify(Object.keys(db.data).sort())
  }
  observer.onReadEnd = (data) => {
    if (data === null) return
    const nextEndpoints = JSON.stringify(Object.keys(data).sort())
    if (prevEndpoints !== nextEndpoints) {
      console.log()
      logRoutes(data)
    }
  }

  // Observa mudanças no arquivo
  watch(file).on('change', () => {
    if (!writing) {
      db.read().catch((e) => {
        if (e instanceof SyntaxError) {
          return console.log(chalk.red(['', `Error parsing ${file}`, e.message].join('\n')))
        }
        console.log(e)
      })
    }
  })
}
