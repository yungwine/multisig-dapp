const tonwebMainnet = new TonWeb(new TonWeb.HttpProvider('https://toncenter.com/api/v2/jsonRPC', {apiKey: '1b312c91c3b691255130350a49ac5a0742454725f910756aff94dfe44858388e'}))
const tonwebTestnet = new TonWeb(new TonWeb.HttpProvider('https://testnet.toncenter.com/api/v2/jsonRPC', {apiKey: '41ac6f57294e0805f1836ac7feb2befd8cbad2d85c87093faf04e4d108499cf8'}))
window.tonweb = tonwebMainnet

const multisig_code = 'b5ee9c7241022b01000418000114ff00f4a413f4bcf2c80b010201200203020148040504daf220c7008e8330db3ce08308d71820f90101d307db3c22c00013a1537178f40e6fa1f29fdb3c541abaf910f2a006f40420f90101d31f5118baf2aad33f705301f00a01c20801830abcb1f26853158040f40e6fa120980ea420c20af2670edff823aa1f5340b9f2615423a3534e202321220202cc06070201200c0d02012008090201660a0b0003d1840223f2980bc7a0737d0986d9e52ed9e013c7a21c2125002d00a908b5d244a824c8b5d2a5c0b5007404fc02ba1b04a0004f085ba44c78081ba44c3800740835d2b0c026b500bc02f21633c5b332781c75c8f20073c5bd0032600201200e0f02012014150115bbed96d5034705520db3c82a020148101102012012130173b11d7420c235c6083e404074c1e08075313b50f614c81e3d039be87ca7f5c2ffd78c7e443ca82b807d01085ba4d6dc4cb83e405636cf0069006027003daeda80e800e800fa02017a0211fc8080fc80dd794ff805e47a0000e78b64c00017ae19573fc100d56676a1ec40020120161702012018190151b7255b678626466a4610081e81cdf431c24d845a4000331a61e62e005ae0261c0b6fee1c0b77746e10230189b5599b6786abe06fedb1c6ca2270081e8f8df4a411c4a05a400031c38410021ae424bae064f6451613990039e2ca840090081e886052261c52261c52265c4036625ccd8a30230201201a1b0017b506b5ce104035599da87b100201201c1d020399381e1f0111ac1a6d9e2f81b60940230015adf94100cc9576a1ec1840010da936cf0557c160230015addfdc20806ab33b50f6200220db3c02f265f8005043714313db3ced54232a000ad3ffd3073004a0db3c2fae5320b0f26212b102a425b3531cb9b0258100e1aa23a028bcb0f269820186a0f8010597021110023e3e308e8d11101fdb3c40d778f44310bd05e254165b5473e7561053dcdb3c54710a547abc242528260020ed44d0d31fd307d307d33ff404f404d1005e018e1a30d20001f2a3d307d3075003d70120f90105f90115baf2a45003e06c2121d74aaa0222d749baf2ab70542013000c01c8cbffcb0704d6db3ced54f80f70256e5389beb198106e102d50c75f078f1b30542403504ddb3c5055a046501049103a4b0953b9db3c5054167fe2f800078325a18e2c268040f4966fa52094305303b9de208e1638393908d2000197d3073016f007059130e27f080705926c31e2b3e630062a2728290060708e2903d08308d718d307f40430531678f40e6fa1f2a5d70bff544544f910f2a6ae5220b15203bd14a1236ee66c2232007e5230be8e205f03f8009322d74a9802d307d402fb0002e83270c8ca0040148040f44302f0078e1771c8cb0014cb0712cb0758cf0158cf1640138040f44301e201208e8a104510344300db3ced54925f06e22a001cc8cb1fcb07cb07cb3ff400f400c9b99895f4'

const BITSHIFT32 = (new tonweb.utils.BN(2)).pow(new tonweb.utils.BN(32))

class MultisigContract extends tonweb.Contract {
    constructor (provider, options) {
        options.code = tonweb.boc.Cell.oneFromBoc(multisig_code)
        super(provider, options)
        this.deploy = () => tonweb.Contract.createMethod(provider, this.createInitExternalMessage())
    }

    createDataCell () {
        var cell = new tonweb.boc.Cell()
        cell.bits.writeUint(this.options.wallet_id, 32)
        cell.bits.writeUint(this.options.n, 8)
        cell.bits.writeUint(this.options.k, 8)
        cell.bits.writeUint(0, 64)
        cell.bits.writeBit(1)
        cell.refs.push(this.options.owner_infos)
        cell.bits.writeBit(0)
        return cell
    }

    async createInitExternalMessage () {
        const {stateInit, address, code, data} = await this.createStateInit()

        const body = new tonweb.boc.Cell()
        const signingMessage = new tonweb.boc.Cell()

        const header = tonweb.Contract.createExternalMessageHeader(address)
        const externalMessage = tonweb.Contract.createCommonMsgInfo(header, stateInit, body)

        return {
            address: address,
            message: externalMessage,

            body,
            signingMessage,
            stateInit,
            code,
            data,
        }
    }
}

const newMultisig = async (pubkeys, wc, wallet_id, k) => {
    if (pubkeys.length < 2) {
        alert('Add at least 2 owners!')
        return
    }

    x = new tonweb.boc.HashMap(8)

    for (let i = 0; i < pubkeys.length; i++) {
        x.elements[i] = [tonweb.utils.hexToBytes(pubkeys[i].padStart(64, '0')), i]
    }

    owner_infos = await x.serialize(
        k => {
            let key = new tonweb.boc.Cell()
            key.bits.writeUint(k, 8)
            return key
        },
        v => {
            let val = new tonweb.boc.Cell()
            val.bits.writeBytes(v[0])
            val.bits.writeUint(v[1], 8)
            return val
        }
    )

    const contract = new MultisigContract(tonweb.provider, {
        wc: wc,
        wallet_id: wallet_id,
        k: k,
        n: pubkeys.length,
        owner_infos: owner_infos
    })

    return contract
}

const getQueryId = () => {
    const time = new tonweb.utils.BN(Math.floor(Date.now() / 1000 + 7200))
    return time.mul(BITSHIFT32)
}

const rootSignOrder = async (owner_id, order) => {
    var cell = new tonweb.boc.Cell()
    cell.bits.writeUint(owner_id, 8)
    cell.bits.writeBit(0)
    cell.bits.writeUint(window.multisig_wallet_id, 32)
    cell.writeCell(order)
    const hash = await cell.hash()
    
    const signature = await ton.send(
        'ton_rawSign', [{ data: tonweb.utils.bytesToHex(hash) }]
    )

    var signedCell = new tonweb.boc.Cell()
    signedCell.bits.writeBytes(tonweb.utils.hexToBytes(signature))
    signedCell.writeCell(cell)

    return signedCell
}

const createExternalMessage = async (boc) => {
    var msg = new tonweb.boc.Cell()
    msg.bits.writeUint(2, 2)
    msg.bits.writeAddress(undefined)
    msg.bits.writeAddress(new tonweb.Address(window.multisig_address))
    msg.bits.writeCoins(0)
    msg.bits.writeBit(0)
    msg.bits.writeBit(1)
    msg.refs.push(boc)
    return msg
}

const addSignature = async (owner_id, cell) => {
    console.log('addSignature call')

    var signatures = new tonweb.boc.HashMap(8)
    await signatures.loadHashMapX2Y(cell, s => tonweb.boc.CellParser.loadUint(s, 8), s => tonweb.boc.CellParser.loadBits(s, 512))
    console.log('hash')
    const hash = await cell.bits.readBits(256)
    console.log('done')
    const signature = await ton.send(
        'ton_rawSign', [{ data: tonweb.utils.bytesToHex(hash) }]
    )
    signatures.elements[owner_id] = signature

    console.log(signatures)

    const signaturesCell = await signatures.serialize(
        k => {
            let key = new tonweb.boc.Cell()
            key.bits.writeUint(k, 8)
            return key
        },
        v => {
            let val = new tonweb.boc.Cell()
            val.bits.writeBytes(v)
            return val
        }
    )

    console.log(signaturesCell)

    var signedCell = new tonweb.boc.Cell()
    signedCell.writeCell(signaturesCell)
    signedCell.bits.writeBytes(hash)
    signedCell.writeCell(cell)

    console.log('addSignature ret')

    return signedCell
}

const signAndSend = async (boc) => {
    console.log(boc)
    var signedOrder = await rootSignOrder(window.multisig_owner_id, boc)
    var message = await createExternalMessage(signedOrder)
    await tonweb.sendBoc(await message.toBoc(false))
}

const createInternalMessage = async (destAddr, amount, bounce, comment) => {
    var msg = new tonweb.boc.Cell()
    msg.bits.writeBit(0) // int_msg_info
    msg.bits.writeBit(1) // ihr_disabled
    msg.bits.writeBit(bounce) // bounce
    msg.bits.writeBit(0) // bounced
    msg.bits.writeAddress(undefined) // src
    msg.bits.writeAddress(new tonweb.Address(destAddr)) // dest
    msg.bits.writeCoins(amount) // value
    msg.bits.writeUint(0, 1 + 4 + 4 + 64 + 32 + 1)
    msg.bits.writeBit(1)
    if (typeof comment == 'string') {
        var body = new tonweb.boc.Cell()
        body.bits.writeUint(0, 32)
        body.bits.writeString(comment)
        msg.refs.push(body)
    } else {
        msg.refs.push(comment)
    }
    return msg
}

const createOrder = async (messages) => {
    var order = new tonweb.boc.Cell()

    order.bits.writeUint(getQueryId(), 64)

    for (const msg of messages) {
        order.bits.writeUint8(3) // message mode
        order.refs.push(msg)
    }

    return order
}
