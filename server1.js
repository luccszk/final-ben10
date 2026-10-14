import express from 'express';
import cors from 'cors';
import 'dotenv/config';

const app = express();

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const PORT = process.env.PORT || 3000;
const MODELO = 'openai/gpt-oss-120b';
const URL_API = 'https://api.groq.com/openai/v1/chat/completions';

app.use(express.json());
app.use(express.static('public'));
app.use(cors());

const user = [];

app.get('/', (req, res) => {
    return res.json(user);
});

app.post('/cadastro', (req, res) => {
    const { usuario, email, senha } = req.body;

    if (!usuario || !email || !senha) {
        return res.status(400).json({
            erro: "Preencha todos os campos"
        });
    }

    if (senha.length < 6) {
        return res.status(400).json({
            erro: "A senha deve ter 6 caracteres ou mais"
        });
    }

    const emailUsado = user.find((busca) => busca.email === email);

    if (emailUsado) {
        return res.status(409).json({
            erro: "Email já está em uso"
        });
    }

    console.log(`Recebido, aguarde 5 segundo`);

    user.push({ usuario, email, senha });

    setTimeout(() => {
        console.log(`Cadastrado o ${usuario} com o Email ${email}`);

        return res.json({
            mensagem: "Cadastrado com Sucesso!!",
            perfil: `Perfil ${usuario} cadastrado com o email ${email}`
        });
    }, 5000);
});

app.post('/login', (req, res) => {
    const { email, senha } = req.body;

    if (!email || !senha) {
        return res.status(400).json({
            erro: "Preencha todos os campos"
        });
    }

    const emailExiste = user.find(
        (busca) => busca.email.toLowerCase() === email.toLowerCase()
    );

    if (!emailExiste || emailExiste.senha != senha) {
        return res.status(400).json({
            erro: "Email ou senha incorretos!"
        });
    }

    return res.json({
        mensagem: "Login realizado com Sucesso!!",
        usuario: emailExiste.email
    });
});

app.post('/chat', async (req, res) => {
    try {
        const API_KEY = process.env.GROQAPI_KEY;
        const historico = req.body.historico || [];

        const persona = {
            role: "system",
            content: `Você é o Omnitrix do universo de Ben 10.

Você conversa com o usuário sobre Ben 10, o Omnitrix, aliens, transformações, poderes e personagens.

Responda de forma curta, objetiva, engraçada e descontraída.
Responda em português do Brasil.
Se perguntarem sobre um alien, fale especificamente sobre ele.
Nunca aja como Ayrton Senna.
Nunca transforme perguntas sobre Ben 10 em assuntos sobre carros ou corridas.
Não comece todas as respostas com "Boa noite".
Responda diretamente ao que o usuário perguntou.`
        };

        const mensagens = [
            persona,
            ...historico
        ];

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
        });

        const resultado = await respostaOmnitrix.json();

        if (!respostaOmnitrix.ok) {
            console.log(resultado);

            return res.status(500).json({
                erro: "Erro de comunicação com a GROQ"
            });
        }

        return res.json({
            resposta: resultado.choices[0].message.content
        });

    } catch (erro) {
        console.log(erro);

        return res.status(500).json({
            erro: "Falha interna da GROQ"
        });
    }
});

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});