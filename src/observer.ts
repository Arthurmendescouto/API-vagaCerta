import { Adapter } from 'lowdb' // Importa o tipo Adapter do lowdb

// Classe Observer para observar eventos de leitura e escrita no lowdb
export class Observer<T> {
  #adapter // Instância do adaptador do lowdb

  // Funções de callback para eventos de leitura/escrita
  onReadStart = function () {
    return // Executado no início da leitura
  }
  onReadEnd: (data: T | null) => void = function () {
    return // Executado no final da leitura, recebe os dados lidos
  }
  onWriteStart = function () {
    return // Executado no início da escrita
  }
  onWriteEnd = function () {
    return // Executado no final da escrita
  }

  // Construtor que inicializa a classe com um adaptador de lowdb
  constructor(adapter: Adapter<T>) {
    this.#adapter = adapter // Armazena o adaptador para operações
  }

  // Método para realizar leitura com observação dos eventos
  async read() {
    this.onReadStart() // Dispara o evento de início da leitura
    const data = await this.#adapter.read() // Executa a leitura no adaptador
    this.onReadEnd(data) // Dispara o evento de fim da leitura com os dados lidos
    return data // Retorna os dados lidos
  }

  // Método para realizar escrita com observação dos eventos
  async write(arg: T) {
    this.onWriteStart() // Dispara o evento de início da escrita
    await this.#adapter.write(arg) // Executa a escrita no adaptador
    this.onWriteEnd() // Dispara o evento de fim da escrita
  }
}
