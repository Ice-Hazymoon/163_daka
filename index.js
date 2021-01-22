// 用户名和密码
const phone = '';
const password = '';

const rp = require('request-promise');
const tough = require('tough-cookie');
const webapi = require('./webapi');
const Cookie = tough.Cookie;
const crypto = require('crypto');

function MD5(str) {
    return crypto.createHash('md5').update(str).digest('hex')
}

async function daka() {
    const cookie = await rp.post(
        'https://music.163.com/weapi/login/cellphone',
        {
            form: webapi({
                phone: phone,
                password: MD5(password),
                countrycode: '86',
                rememberLogin: 'true',
                csrf_token: ''
            }),
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.1.2 Safari/605.1.15',
                Referer: 'https://music.163.com',
                'Content-Type': 'application/x-www-form-urlencoded',
                'Cookie': 'os=pc'
            },
            json: true,
            resolveWithFullResponse: true,
            transform(body, response) {
                console.log(body);
                return Object.assign(
                    ...response.headers['set-cookie'].map(cookie => {
                        const c = Cookie.parse(cookie).toJSON();
                        const obj = {};
                        obj[c.key] = c.value;
                        return obj;
                    })
                );
            }
        }
    );

    const cookieStr = Object.keys(cookie)
        .map(k => `${k}=${cookie[k]}`)
        .join(';');

    const playlist = await rp.post(
        'https://music.163.com/weapi/v1/discovery/recommend/resource',
        {
            form: webapi({
                csrf_token: cookie.__csrf
            }),
            headers: {
                cookie: cookieStr
            },
            json: true,
            transform(body) {
                if (body.code === 200) {
                    return body.recommend.map(r => r.id);
                } else {
                    throw new Error('获取推荐歌曲失败');
                }
            }
        }
    );

    let songid = [];
    for (let index = 0; index < playlist.length; index++) {
        const playlist_id = playlist[index];
        const id = await rp.post(
            'https://music.163.com/weapi/v3/playlist/detail',
            {
                qs: {
                    csrf_token: ''
                },
                form: webapi({
                    id: playlist_id,
                    n: 1000,
                    csrf_token: ''
                }),
                headers: {
                    cookie: cookieStr
                },
                json: true,
                transform(body) {
                    if (body.code === 200) {
                        return body.playlist.trackIds.map(i => i.id);
                    } else {
                        throw new Error('获取歌曲ID失败');
                    }
                }
            }
        );
        songid = songid.concat(id);
    }

    const daka = await rp.post(
        'http://music.163.com/weapi/feedback/weblog',
        {
            form: webapi({
                logs: JSON.stringify(
                    songid.map(id => {
                        return {
                            action: 'play',
                            json: {
                                download: 0,
                                end: 'playend',
                                id: id.id,
                                sourceId: '',
                                time: 240,
                                type: 'song',
                                wifi: 0
                            }
                        };
                    })
                )
            }),
            headers: {
                cookie: cookieStr
            },
            json: true
        }
    );
    if (daka.code === 200) {
        return daka;
    } else {
        throw new Error(daka.message);
    }
}

daka().then(e => {
    console.log('打卡成功', e);
}).catch(err => {
    console.log('打卡失败', err);
})
