import express from 'express';
import { App, Octokit } from 'octokit';
import { Webhooks } from '@octokit/webhooks';
import _sodium from 'libsodium-wrappers';

const app = express();


const app_id = process.env.APP_ID;
const client_id = process.env.CLIENT_ID;
const client_secret = process.env.CLIENT_SECRET;
const private_key = process.env.APP_PRIVATE_KEY;
const pat = process.env.PAT;
const new_repo_name = process.env.NEW_REPO_NAME;

app.use(express.json(
    {
        verify: (req, res, buf, encoding) => {
            if (buf && buf.length) {
                req.rawBody = buf.toString(encoding || 'utf8');
            }
        }
    }
));

async function encrypt_secret(secret_value, public_key) {
    await _sodium.ready;

    const sodium = _sodium;

    let binkey = sodium.from_base64(public_key, sodium.base64_variants.ORIGINAL);
    let binsec = sodium.from_string(secret_value);

    let enc_bytes = sodium.crypto_box_seal(binsec, binkey);

    return sodium.to_base64(enc_bytes, sodium.base64_variants.ORIGINAL);
}

async function verify_signature(req) {
    const webhook = new Webhooks({
        secret: process.env.WEBHOOK_SECRET,
    });

    const payload = req.rawBody;
    const signature = req.headers['x-hub-signature-256'];

    if (!signature) {
        throw new Error('No signature found on request');
    }

    const verified = await webhook.verify(payload, signature);

    if (!verified) {
        throw new Error('Signature verification failed');
    }
}

app.post('/', async (req, res) => {

    try {
        await verify_signature(req);

        if (!req.body) throw new Error('No body found on request');

        const payload = req.body;

        if (payload.action === 'created' && payload.installation && payload.installation.target_type === "Organization") {
            console.log(`Installation done : ${payload.installation.account.login}`);

            const app = new App({
                appId: app_id,
                privateKey: private_key,
                oauth: {
                    clientId: client_id,
                    clientSecret: client_secret,
                },
            });

            console.log("Logged in");

            const octokit = await app.getInstallationOctokit(payload.installation.id);

            const template_owner = 'Falck-Studios';
            const template_repo = 'TEMPLATE_github_data_fetcher';

            // Maybe check if the repo already exists
            // Maybe we should use fork instead? Pulling updates?
            await octokit.request("POST /repos/{template_owner}/{template_repo}/generate", {
                template_owner: template_owner,
                template_repo: template_repo,
                owner: payload.installation.account.login,
                name: new_repo_name,
                include_all_branches: false,
            });

            console.log("Repo created");

            const repo_public_key = await octokit.request("GET /repos/{owner}/{repo}/actions/secrets/public-key", {
                owner: payload.installation.account.login,
                repo: new_repo_name,
            });

            const public_key = repo_public_key.data.key;
            const key_id = repo_public_key.data.key_id;

            const secret_value = await encrypt_secret(pat, public_key);

            await octokit.request("PUT /repos/{owner}/{repo}/actions/secrets/{secret_name}", {
                owner: payload.installation.account.login,
                repo: new_repo_name,
                secret_name: 'FALCK_STUDIOS_PRODUCT_LICENSE_KEY',
                encrypted_value: secret_value,
                key_id: key_id,
            });

            const encrupted_installation_id = await encrypt_secret(payload.installation.id, public_key);

            await octokit.request("PUT /repos/{owner}/{repo}/actions/secrets/{secret_name}", {
                owner: payload.installation.account.login,
                repo: new_repo_name,
                secret_name: 'FALCK_STUDIOS_INSTALLATION_ID',
                encrypted_value: encrupted_installation_id,
                key_id: key_id,
            });

            console.log("Secret created");

        }
    } catch (e) {
        console.log(e);
        return res.status(400).send('Bad Request');
    }

});


const port = Number(process.env.PORT || '3000')
app.listen(port, () => {
    console.log(`Server running on port ${port}`)
});