const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
app.use(express.json());
app.use(cors());

const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'Lindo2003',
    database: 'crud',
});

db.connect((err) => {
    if (err) {
        console.error('Error connecting to the database:', err);
        return;
    }
    console.log('Connected to the database');
});

const secretKey = 'your_secret_key'; // Substitua por uma chave secreta segura

// Middleware para verificar o token
function verifyToken(req, res, next) {
    const token = req.headers['authorization'];
    if (!token) {
        return res.status(403).json({ message: "Token não fornecido" });
    }
    jwt.verify(token, secretKey, (err, decoded) => {
        if (err) {
            return res.status(403).json({ message: "Falha na autenticação do token" });
        }
        req.userId = decoded.id;
        next();
    });
}

// Rotas de Autenticação
app.post('/Register', (req, res) => {
    const { nome, email, password } = req.body;
    if (!nome || !email || !password) {
        return res.status(400).json({ message: "Username, email and password are required" });
    }

    bcrypt.hash(password, 10, (err, hash) => {
        if (err) {
            console.error('Error hashing password:', err);
            return res.status(500).json({ message: "Erro ao hashear a senha" });
        }

        const sql = 'INSERT INTO users (nome, email, password) VALUES (?, ?, ?)';
        db.query(sql, [nome, email, hash], (err, result) => {
            if (err) {
                console.error('Error executing query:', err);
                return res.status(500).json({ message: "Erro ao executar a consulta" });
            }
            return res.json({ message: "Usuário registrado com sucesso" });
        });
    });
});

app.post('/Login', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
    }

    const sql = 'SELECT * FROM users WHERE email = ?';
    db.query(sql, [email], (err, data) => {
        if (err) {
            console.error('Error executing query:', err);
            return res.status(500).json({ message: "Erro ao executar a consulta" });
        }
        if (data.length > 0) {
            const user = data[0];
            bcrypt.compare(password, user.password, (err, result) => {
                if (err) {
                    console.error('Error comparing passwords:', err);
                    return res.status(500).json({ message: "Erro ao comparar as senhas" });
                }
                if (result) {
                    const token = jwt.sign({ id: user.id, email: user.email }, secretKey, { expiresIn: '1h' });
                    return res.json({ message: "Login Realizado", token });
                } else {
                    return res.json({ message: "Login Falhou" });
                }
            });
        } else {
            return res.json({ message: "Login Falhou" });
        }
    });
});

// Rotas de Caixa
app.get('/totals', verifyToken, (req, res) => {
    const sql = `
        SELECT 
            DATE_FORMAT(date, '%Y-%m') AS month,
            SUM(CASE WHEN payment_type = 'N' THEN receipt_amount ELSE 0 END) AS total_numerario,
            SUM(CASE WHEN payment_type = 'A' THEN receipt_amount ELSE 0 END) AS total_multibanco,
            SUM(CASE WHEN payment_type = 'C' THEN receipt_amount ELSE 0 END) AS total_cheques,
            SUM(CASE WHEN payment_type IN ('N', 'A') THEN receipt_amount ELSE 0 END) AS total_numerario_multibanco,
            SUM(payment_amount) AS total_payment_amount,
            SUM(receipt_amount) - SUM(payment_amount) AS saldo_total
        FROM caixa
        WHERE ativo = TRUE
        GROUP BY DATE_FORMAT(date, '%Y-%m')
    `;
    db.query(sql, (err, results) => {
        if (err) {
            console.error('Error fetching totals:', err);
            return res.status(500).json({ message: "Erro ao buscar os totais" });
        }
        return res.json(results);
    });
});

app.post('/cash_register', verifyToken, (req, res) => {
    const { date, document_number, document_type, description, payment_type, receipt_amount, payment_amount, user_id, is_pending } = req.body;

    // Verificar se já existe um documento com o mesmo número e tipo
    const checkSql = 'SELECT * FROM caixa WHERE document_number = ? AND document_type = ?';
    db.query(checkSql, [document_number, document_type], (err, results) => {
        if (err) {
            console.error('Error executing query:', err);
            return res.status(500).json({ message: "Erro ao executar a consulta" });
        }
        if (results.length > 0) {
            return res.status(400).json({ message: "Documento com o mesmo número e tipo já existe" });
        }

        // Inserir o novo registro se não houver duplicatas
        const insertSql = 'INSERT INTO caixa (date, document_number, document_type, description, payment_type, receipt_amount, payment_amount, user_id, is_pending) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)';
        db.query(insertSql, [date, document_number, document_type, description, payment_type, receipt_amount || 0, payment_amount || 0, user_id, is_pending], (err, results) => {
            if (err) {
                console.error('Error executing query:', err);
                return res.status(500).json({ message: "Erro ao executar a consulta" });
            }
            return res.json({ message: "Registro inserido com sucesso" });
        });
    });
});

app.get('/pending', verifyToken, (req, res) => {
    const sql = 'SELECT * FROM caixa WHERE is_pending = TRUE AND ativo = TRUE';
    db.query(sql, (err, results) => {
        if (err) {
            console.error('Error fetching data:', err);
            return res.status(500).json({ message: "Erro ao buscar os dados" });
        }
        return res.json(results);
    });

});

app.put('/pending/:id/mark_as_paid', verifyToken, (req, res) => {
    const { id } = req.params;
    const { payment_type } = req.body;
    const sql = 'UPDATE caixa SET is_pending = FALSE, payment_type = ? WHERE id = ?';
    db.query(sql, [payment_type, id], (err, results) => {
        if (err) {
            console.error('Error executing query: ', err);
            return res.status(500).json({ message: "Erro ao executar a consulta" });
        }
        return res.json({ message: "Recebimento marcado como pago com sucesso" });
    });
});

app.get('/cash_register', verifyToken, (req, res) => {
    const { month } = req.query;
    const sql = `
        SELECT *, (receipt_amount - payment_amount) AS saldo_diario
        FROM caixa
        WHERE DATE_FORMAT(date, '%Y-%m') = ? AND ativo = TRUE
    `;
    db.query(sql, [month], (err, results) => {
        if (err) {
            console.error('Error fetching data:', err);
            return res.status(500).json({ message: "Erro ao buscar os dados" });
        }
        return res.json(results);
    });
});

app.get('/cash_register/:id', verifyToken, (req, res) => {
    const { id } = req.params;
    const sql = 'SELECT * FROM caixa WHERE id = ?';
    db.query(sql, [id], (err, result) => {
        if (err) {
            console.error('Error fetching data:', err);
            return res.status(500).json({ message: "Erro ao buscar os dados" });
        }
        return res.json(result[0]);
    });
});

app.put('/cash_register/:id', verifyToken, (req, res) => {
    const { id } = req.params;
    const { date, document_number, document_type, description, payment_type, receipt_amount, payment_amount, user_id } = req.body;

    // Verificar se já existe um documento com o mesmo número e tipo, excluindo o registro atual
    const checkSql = 'SELECT * FROM caixa WHERE document_number = ? AND document_type = ? AND id != ?';
    db.query(checkSql, [document_number, document_type, id], (err, results) => {
        if (err) {
            console.error('Error executing query:', err);
            return res.status(500).json({ message: "Erro ao executar a consulta" });
        }
        if (results.length > 0) {
            return res.status(400).json({ message: "Documento com o mesmo número e tipo já existe" });
        }

        // Atualizar o registro se não houver duplicatas
        const updateSql = 'UPDATE caixa SET date = ?, document_number = ?, document_type = ?, description = ?, payment_type = ?, receipt_amount = ?, payment_amount = ?, user_id = ? WHERE id = ?';
        db.query(updateSql, [date, document_number, document_type, description, payment_type || null, receipt_amount || 0, payment_amount || 0, user_id, id], (err, result) => {
            if (err) {
                console.error('Error executing query:', err);
                return res.status(500).json({ message: "Erro ao executar a consulta" });
            }
            return res.json({ message: "Registro atualizado com sucesso" });
        });
    });
});

app.put('/cash_register/inactivate/:id', verifyToken, (req, res) => {
    const { id } = req.params;
    const sql = 'UPDATE caixa SET ativo = FALSE WHERE id = ?';
    db.query(sql, [id], (err, result) => {
        if (err) {
            console.error('Error executing query:', err);
            return res.status(500).json({ message: "Erro ao executar a consulta" });
        }
        return res.json({ message: "Registro marcado como inativo com sucesso" });
    });
});

app.listen(8081, () => {
    console.log('Server started on port 8081');
});