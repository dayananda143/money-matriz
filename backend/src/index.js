require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/stocks', require('./routes/stocks'));
app.use('/api/relationships', require('./routes/relationships'));
app.use('/api/portfolio', require('./routes/portfolio'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/config', require('./routes/config'));
app.use('/api/company', require('./routes/company'));
app.use('/api/ideas', require('./routes/ideas'));

app.get('/api/health', (_, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 3003;
app.listen(PORT, () => console.log(`Money Matriz backend running on port ${PORT}`));
