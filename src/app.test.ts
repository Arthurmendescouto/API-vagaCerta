import assert from 'node:assert/strict' // Para asserções nos testes
import { writeFileSync } from 'node:fs' // Para criar arquivos temporários
import { join } from 'node:path' // Para manipulação de caminhos
import test from 'node:test' // Framework nativo de testes

import getPort from 'get-port' // Para obter uma porta disponível
import { Low, Memory } from 'lowdb' // Banco de dados em memória
import { temporaryDirectory } from 'tempy' // Para criar diretórios temporários

import { createApp } from './app.js' // Função para criar o app
import { Data } from './service.js' // Tipos relacionados ao serviço

// Definições de tipos para os testes
type Test = {
  method: HTTPMethods
  url: string
  statusCode: number
}

type HTTPMethods = 'DELETE' | 'GET' | 'HEAD' | 'PATCH' | 'POST' | 'PUT' | 'OPTIONS'

// Obtém uma porta disponível para o servidor
const port = await getPort()

// Criação de um diretório estático temporário com um arquivo HTML
const tmpDir = temporaryDirectory()
const file = 'file.html'
writeFileSync(join(tmpDir, file), 'utf-8') // Cria o arquivo temporário

// Configuração inicial do banco de dados em memória
const db = new Low<Data>(new Memory<Data>(), {})
db.data = {
  posts: [{ id: '1', title: 'foo' }], // Exemplo de post
  comments: [{ id: '1', postId: '1' }], // Comentário relacionado ao post
  object: { f1: 'foo' }, // Exemplo de objeto
}

// Criação do app com os dados do banco e o diretório estático
const app = createApp(db, { static: [tmpDir] })

// Inicializa o servidor e o encerra após os testes
await new Promise<void>((resolve, reject) => {
  try {
    const server = app.listen(port, () => resolve())
    test.after(() => server.close()) // Fecha o servidor após os testes
  } catch (err) {
    reject(err)
  }
})

// Teste principal da aplicação
await test('createApp', async (t) => {
  // URLs para os testes
  const POSTS = '/posts'
  const POSTS_WITH_COMMENTS = '/posts?_embed=comments'
  const POST_1 = '/posts/1'
  const POST_NOT_FOUND = '/posts/-1'
  const POST_WITH_COMMENTS = '/posts/1?_embed=comments'
  const COMMENTS = '/comments'
  const POST_COMMENTS = '/comments?postId=1'
  const NOT_FOUND = '/not-found'
  const OBJECT = '/object'
  const OBJECT_1 = '/object/1'

  // Casos de teste cobrindo diferentes métodos e URLs
  const arr: Test[] = [
    // Arquivos estáticos
    { method: 'GET', url: '/', statusCode: 200 },
    { method: 'GET', url: '/test.html', statusCode: 200 },
    { method: 'GET', url: `/${file}`, statusCode: 200 },

    // CORS (Preflight request)
    { method: 'OPTIONS', url: POSTS, statusCode: 204 },

    // API: Testa endpoints com diferentes métodos e status esperados
    { method: 'GET', url: POSTS, statusCode: 200 },
    { method: 'GET', url: POSTS_WITH_COMMENTS, statusCode: 200 },
    { method: 'GET', url: POST_1, statusCode: 200 },
    { method: 'GET', url: POST_NOT_FOUND, statusCode: 404 },
    { method: 'GET', url: POST_WITH_COMMENTS, statusCode: 200 },
    { method: 'GET', url: COMMENTS, statusCode: 200 },
    { method: 'GET', url: POST_COMMENTS, statusCode: 200 },
    { method: 'GET', url: OBJECT, statusCode: 200 },
    { method: 'GET', url: OBJECT_1, statusCode: 404 },
    { method: 'GET', url: NOT_FOUND, statusCode: 404 },

    // Testes para POST
    { method: 'POST', url: POSTS, statusCode: 201 },
    { method: 'POST', url: POST_1, statusCode: 404 },
    { method: 'POST', url: NOT_FOUND, statusCode: 404 },

    // Testes para PUT
    { method: 'PUT', url: POST_1, statusCode: 200 },
    { method: 'PUT', url: OBJECT, statusCode: 200 },
    { method: 'PUT', url: POST_NOT_FOUND, statusCode: 404 },

    // Testes para PATCH
    { method: 'PATCH', url: POST_1, statusCode: 200 },
    { method: 'PATCH', url: OBJECT, statusCode: 200 },
    { method: 'PATCH', url: POST_NOT_FOUND, statusCode: 404 },

    // Testes para DELETE
    { method: 'DELETE', url: POST_1, statusCode: 200 },
    { method: 'DELETE', url: POST_NOT_FOUND, statusCode: 404 },
  ]

  // Executa cada caso de teste
  for (const tc of arr) {
    await t.test(`${tc.method} ${tc.url}`, async () => {
      const response = await fetch(`http://localhost:${port}${tc.url}`, {
        method: tc.method,
      })
      assert.equal(
        response.status,
        tc.statusCode,
        `${response.status} !== ${tc.statusCode} ${tc.method} ${tc.url} failed`, // Mensagem de erro detalhada
      )
    })
  }
})
