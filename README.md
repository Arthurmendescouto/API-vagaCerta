# **API Vaga Certa**

Este repositório contém a API utilizada pelo front-end do **Vaga Certa**. A API é responsável por gerenciar dados como e-mail e senha para realização de login, bem como receber e atualizar informações de novos usuários adicionados pelo front-end.

---

## **Índice**

- [Visão Geral](#visão-geral)
- [Funcionalidades](#funcionalidades)
- [Pré-requisitos](#pré-requisitos)
- [Instalação](#instalação)
- [Uso](#uso)
- [Contato e Suporte](#contato-e-suporte)
- [Licença](#licença)

---

## **Visão Geral**

A API do **Vaga Certa** é uma aplicação simples baseada em JSON Server que permite a comunicação entre o front-end e o back-end. Ela gerencia o login dos usuários através do e-mail e senha, bem como permite adicionar e atualizar usuários a partir do front-end.

---

## **Funcionalidades**

- **Login**:
  - Valida e autentica o e-mail e senha enviados pelo front-end.
- **Gerenciamento de usuários**:
  - Recebe novos usuários adicionados pelo front-end.
  - Permite atualizar informações de usuários existentes através do front-end.

---

## **Pré-requisitos**

Antes de utilizar a API, certifique-se de ter instalado:

- [Node.js](https://nodejs.org/) (versão recomendada: 16.x ou superior)

---

## **Instalação**

1. Clone este repositório:
   ```bash
   git clone https://github.com/Arthurmendescouto/API-vagaCerta.git
   ```

2. Acesse o diretório do projeto:
   ```bash
   cd API-vagaCerta
   ```

3. Instale o JSON Server:
   ```bash
   npm install json-server
   ```

---

## **Uso**

1. Inicie o servidor JSON Server com o arquivo `db.json`:
   ```bash
   npx json-server db.json
   ```

2. A API estará disponível em:
   ```plaintext
   http://localhost:3000
   ```

3. Configure o front-end para acessar essa URL (alterando a propriedade `baseURL` no Axios, caso necessário).

---

## **Contato e Suporte**

Se você tiver dúvidas ou encontrar problemas, sinta-se à vontade para entrar em contato:

- **E-mail**: [arthurmendescouto16@gmail.com](arthurmendescouto16@gmail.com)

---

## **Licença**

Este projeto está licenciado sob a Licença MIT. Veja o arquivo [LICENSE](./LICENSE) para mais detalhes.
