import express from 'express'
import cors from 'cors'
import 'dotenv/config'
import path from 'path'
import { fileURLToPath } from 'url'
import pg from 'pg'
import bcrypt from 'bcryptjs'

const { Pool } = pg

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()

const PORT = process.env.PORT || 3000
const MODELO = process.env.GROQ_MODEL || 'openai/gpt-oss-120b'
const URL_API = 'https://api.groq.com/openai/v1/chat/completions'

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
})

app.use(express.json())
app.use(cors())
app.use(express.static(path.join(__dirname, 'public')))

const bancoPronto = pool.query(`
    CREATE TABLE IF NOT EXISTS usuarios (
        id SERIAL PRIMARY KEY,
        usuario TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        senha TEXT NOT NULL
    )
`)

app.post('/cadastro', async (req, res) => {
    try {
        await bancoPronto

        const { usuario, email, senha } = req.body

        if (
            typeof usuario !== 'string' ||
            typeof email !== 'string' ||
            typeof senha !== 'string' ||
            !usuario.trim() ||
            !email.trim() ||
            !senha
        ) {
            return res.status(400).json({
                erro: 'Preencha todos os campos'
            })
        }

        if (senha.length < 6) {
            return res.status(400).json({
                erro: 'A senha deve ter 6 caracteres ou mais'
            })
        }

        const nomeNormalizado = usuario.trim()
        const emailNormalizado = email.trim().toLowerCase()

        const senhaHash = await bcrypt.hash(senha, 10)

        await pool.query(`
            INSERT INTO usuarios (usuario, email, senha)
            VALUES ($1, $2, $3)
        `, [nomeNormalizado, emailNormalizado, senhaHash])

        console.log(`Usuário cadastrado: ${nomeNormalizado}`)

        return res.json({
            mensagem: 'Cadastrado com sucesso!',
            perfil: `Perfil ${nomeNormalizado} cadastrado com o email ${emailNormalizado}`
        })

    } catch (erro) {
        console.log(erro)

        if (erro.code === '23505') {
            return res.status(409).json({
                erro: 'Email já está em uso'
            })
        }

        return res.status(500).json({
            erro: 'Erro ao realizar cadastro'
        })
    }
})

app.post('/login', async (req, res) => {
    try {
        await bancoPronto

        const { email, senha } = req.body

        if (
            typeof email !== 'string' ||
            typeof senha !== 'string' ||
            !email.trim() ||
            !senha
        ) {
            return res.status(400).json({
                erro: 'Preencha todos os campos'
            })
        }

        const emailNormalizado = email.trim().toLowerCase()

        const resultado = await pool.query(
            'SELECT * FROM usuarios WHERE email = $1',
            [emailNormalizado]
        )

        const usuarioEncontrado = resultado.rows[0]

        if (!usuarioEncontrado) {
            return res.status(400).json({
                erro: 'Email ou senha incorretos!'
            })
        }

        const senhaCorreta = await bcrypt.compare(
            senha,
            usuarioEncontrado.senha
        )

        if (!senhaCorreta) {
            return res.status(400).json({
                erro: 'Email ou senha incorretos!'
            })
        }

        console.log(`Login realizado: ${usuarioEncontrado.usuario}`)

        return res.json({
            mensagem: 'Login realizado com sucesso!',
            usuario: usuarioEncontrado.usuario
        })

    } catch (erro) {
        console.log(erro)

        return res.status(500).json({
            erro: 'Erro ao realizar login'
        })
    }
})

app.post('/chat', async (req, res) => {
    try {
        const API_KEY = process.env.GROQ_API_KEY || process.env.GROQAPI_KEY

        if (!API_KEY) {
            return res.status(500).json({
                erro: 'Chave da Groq não encontrada.'
            })
        }

        const historico = Array.isArray(req.body.historico)
            ? req.body.historico
            : []

        const nomeUsuario = typeof req.body.usuario === 'string'
            ? req.body.usuario.slice(0, 40)
            : ''

        const persona = {
            role: 'system',
            content: `Você é o Omnitrix do universo de Ben 10.

Você conversa com o usuário sobre Ben 10, o Omnitrix, aliens, transformações, poderes e personagens.
${nomeUsuario ? `O usuário se chama ${nomeUsuario}.` : ''}
Você é o Omnitrix, do Ben 10. Responda sempre em no máximo 2 frases curtas, de forma direta, sem listas e sem enrolação.
Responda de forma curta, objetiva, engraçada e descontraída.
Responda em português do Brasil.
Se perguntarem sobre um alien, fale especificamente sobre ele.
Nunca aja como Ayrton Senna.
Nunca transforme perguntas sobre Ben 10 em assuntos sobre carros ou corridas.
Não comece todas as respostas com "Boa noite".
Responda diretamente ao que o usuário perguntou.`
        }

        const mensagens = [
            persona,
            ...historico
        ]

        const respostaOmnitrix = await fetch(URL_API, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}`
            },
            body: JSON.stringify({
                model: MODELO,
                messages: mensagens
            })
        })

        const resultado = await respostaOmnitrix.json()

        if (!respostaOmnitrix.ok) {
            console.log(resultado)

            return res.status(respostaOmnitrix.status).json({
                erro: resultado.error?.message || 'Erro de comunicação com a GROQ'
            })
        }

        return res.json({
            resposta: resultado.choices[0].message.content
        })

    } catch (erro) {
        console.log(erro)

        return res.status(500).json({
            erro: 'Falha interna no servidor'
        })
    }
})

if (!process.env.VERCEL) {
    app.listen(PORT, () => {
        console.log(`Servidor rodando na porta ${PORT}`)
    })
}

export default app
