// Importações essenciais para caminhos, URLs, servidor, banco de dados e templates
import { dirname, isAbsolute, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { App } from '@tinyhttp/app' // Framework HTTP
import { cors } from '@tinyhttp/cors' // Configuração de CORS
import { Eta } from 'eta' // Motor de templates
import { Low } from 'lowdb' // Banco de dados JSON
import { json } from 'milliparsec' // Middleware para corpo JSON
import sirv from 'sirv' // Middleware para servir arquivos estáticos

import { Data, isItem, Service } from './service.js'

// Configura diretório base e ambiente de produção
const __dirname = dirname(fileURLToPath(import.meta.url))
const isProduction = process.env['NODE_ENV'] === 'production'

// Configuração do motor de templates
const eta = new Eta({
  views: join(__dirname, '../views'),
  cache: isProduction, // Cache habilitado apenas em produção
})

// Função para criar a aplicação
export function createApp(db: Low<Data>, options = {}) {
  const service = new Service(db) // Serviço para interação com o banco de dados
  const app = new App() // Instância do servidor

  // Servir arquivos estáticos
  app.use(sirv('public', { dev: !isProduction }))
  options.static
    ?.map((path) => (isAbsolute(path) ? path : join(process.cwd(), path)))
    .forEach((dir) => app.use(sirv(dir, { dev: !isProduction })))

  // Configuração de CORS
  app.use((req, res, next) =>
    cors({
      allowedHeaders: req.headers['access-control-request-headers']
        ?.split(',')
        .map((h) => h.trim()),
    })(req, res, next),
  )

  // Middleware para processar corpo JSON
  app.use(json())

  // Rotas principais para operações CRUD
  app.get('/', (_req, res) => res.send(eta.render('index.html', { data: db.data }))) // Página inicial com dados

  app.get('/:name', (req, res, next) => {
    const { name = '' } = req.params
    const query = Object.fromEntries(
      Object.entries(req.query)
        .map(([key, value]) =>
          ['_start', '_end', '_limit', '_page', '_per_page'].includes(key) &&
          typeof value === 'string'
            ? [key, parseInt(value)]
            : [key, value],
        )
        .filter(([, value]) => !Number.isNaN(value)),
    )
    res.locals['data'] = service.find(name, query) // Busca itens por nome e filtros
    next?.()
  })

  app.get('/:name/:id', (req, res, next) => {
    const { name = '', id = '' } = req.params
    res.locals['data'] = service.findById(name, id, req.query) // Busca item por ID
    next?.()
  })

  app.post('/:name', async (req, res, next) => {
    const { name = '' } = req.params
    if (isItem(req.body)) res.locals['data'] = await service.create(name, req.body) // Criação de novo item
    next?.()
  })

  app.put('/:name/:id', async (req, res, next) => {
    const { name = '', id = '' } = req.params
    if (isItem(req.body)) res.locals['data'] = await service.updateById(name, id, req.body) // Atualização de item
    next?.()
  })

  app.delete('/:name/:id', async (req, res, next) => {
    const { name = '', id = '' } = req.params
    res.locals['data'] = await service.destroyById(name, id, req.query['_dependent']) // Exclusão de item
    next?.()
  })

  // Middleware final para retornar os dados ou erro 404
  app.use('/:name', (req, res) => {
    const { data } = res.locals
    if (data === undefined) {
      res.sendStatus(404) // Item não encontrado
    } else {
      if (req.method === 'POST') res.status(201) // Status 201 para criação
      res.json(data) // Retorna os dados encontrados
    }
  })

  return app // Retorna a instância configurada do aplicativo
}
