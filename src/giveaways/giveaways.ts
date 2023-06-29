import mongoose from 'mongoose'
import {
    Client,
    Collection,
    ColorResolvable,
    EmbedBuilder,
    TextChannel,
    User
} from 'discord.js'
import {
    GiveawayClientOptions,
    GiveawayClientSchema,
    StartOptions
} from './giveaways.interfaces'

export class GiveawayClient {
    public schema = mongoose.model<GiveawayClientSchema>(
        'quickly-giveaways',
        new mongoose.Schema({
            MessageID: String,
            EndsAt: Number,
            Guild: String,
            Channel: String,
            winners: Number,
            prize: String,
            description: String,
            hostedBy: String,
            Activated: Boolean,
        })
    )
    public options: GiveawayClientOptions
    public collection: Collection<string, GiveawayClientSchema> = new Collection()

    /**
     * @name GiveawayClient
     * @kind constructor
     * @description Initialzing the giveaway client
     */
    constructor(options: GiveawayClientOptions) {
        const { client, mongooseConnectionString, defaultColor, emoji } = options

        if (mongoose.connection.readyState !== 1) {
            if (!options.mongooseConnectionString)
                throw new Error(
                    "Mongoose ile kurulmuş bir bağlantı bulunmamakta ve bir mongoose bağlantısı gerekmektedir!"
                )
            mongoose.connect(mongooseConnectionString)
        }
        this.options = {
            client,
            mongooseConnectionString,
            defaultColor: defaultColor || '#FF0000',
            emoji: emoji || '🎉'
        }

        this.ready()
    }

    private ready() {
        this.schema.find().then((data) => {
            if (!data?.length) return
            data.forEach((value) => {
                this.collection.set(value.MessageID, value)
            })
        })

        this.checkWinners()
    }

    /**
     * @method
     * @description Starts a giveaway
     */
    public start(options: StartOptions) {
        const { channel, time, winners, prize, description, hostedBy } = options
        const desc = [
            `Çekiliş ${new Date(
                Date.now() + time
            ).toLocaleString()} tarihinde bitecek!\n` + `Düzenleyen: ${hostedBy}`
        ]
        if (description) desc.push(`\n${description}`)
        const embed = new EmbedBuilder()
            .setTitle(prize)
            .setDescription(desc.join('\n'))
            .setColor(this.options.defaultColor)
            .setTimestamp()

        channel.send({
            embeds: [embed]
        }).then((msg) => {
            msg.react(this.options.emoji)
            const values = {
                MessageID: msg.id,
                EndsAt: Date.now() + time,
                Guild: channel.guild.id,
                Channel: channel.id,
                winners,
                prize,
                description,
                hostedBy,
                Activated: true
            }
            const newGiveawaySchema = new this.schema(values)

            newGiveawaySchema.save()
            this.collection.set(values.MessageID, values)
        })
    }

    /**
     * @method
     * @param {String} MessageID Message ID for the giveaway
     * @param {Boolean} getWinner Choose a winner?
     * @description Ends a giveaway
     */
    end(MessageID: string, getWinner: boolean) {
        this.schema.findOne(
            { MessageID, Activated: true },
            async (err, data) => {
                const giveawayChannel = this.options.client.channels.cache.get(
                    data.Channel
                )
                if (err) throw err
                if (!data)
                    throw new Error(
                        `${MessageID} ID'si ile devam eden bir çekiliş bulunamadı!`
                    )
                if (getWinner) {
                    this.getReactions(
                        data.Channel,
                        data.MessageID,
                        data.winners
                    ).then((reactions: any) => {
                        const winners = reactions.map((user) => user).join(", ")
                        ;(giveawayChannel as TextChannel).send(
                            {
                                content: `Tebrikler ${winners}! **${data.prize}** kazandınız!`
                            }
                        )
                    })
                } else {
                    const oldMessage = await this.getMessage(
                        data.Channel,
                        data.MessageID
                    )
                    oldMessage.edit({
                        embeds: [new EmbedBuilder().setTitle("Çekiliş Sona Erdi!")]
                    })
                }
                data.Activated = false
                data.save()
                this.collection.delete(MessageID)
            }
        )
    }

    /**
     * @method
     * @description Picks a new winner
     */
    public reroll(MessageID: string) {
        return new Promise((ful, rej) => {
            const filtered = this.collection.filter(
                (value) => value.Activated == false
            )
            const data = filtered.get(MessageID)
            if (!data)
                rej("Çekiliş bulunamadı veya devam ediyor!")
            const giveawayChannel = this.getChannel(data.Channel)
            this.getReactions(data.Channel, MessageID, data.winners).then(
                (reactions: any) => {
                    const winner = reactions.map((user) => user).join(", ")
                    giveawayChannel.send({
                        content: `Çekiliş yeniden çekildi! Tebrikler ${winner}! **${data.prize}** kazandınız!`
                    })
                }
            )
        })
    }

    /**
     * @method
     * @param {Boolean} activatedOnly Get only activated giveaways
     * @param {Boolean} all Get all giveaways
     * @param {Message} message Message for the channel
     * @description Get data on current giveaways hosted by the bot
     */
    public getCurrentGiveaways(activatedOnly = true, all = false, message) {
        return new Promise((ful, rej) => {
            if (all) {
                if (activatedOnly) {
                    ful(
                        this.collection.filter(
                            (value) => value.Activated == true
                        )
                    )
                } else {
                    ful(this.collection)
                }
            } else {
                if (activatedOnly) {
                    ful(
                        this.collection.filter(
                            (value) =>
                                value.Guild == message.guild.id &&
                                value.Activated == true
                        )
                    )
                }
                ful(
                    this.collection.filter(
                        (value) => value.Guild == message.guild.id
                    )
                )
            }
        })
    }

    /**
     * @method
     * @param {Boolean} all Get data from all guilds?
     * @param {String} guildID Guild ID if all=false
     * @description Removes (activated = false) giveaways
     */
    public removeCachedGiveaways(all = false, guildID) {
        if (!all) {
            this.schema.find(
                { Guild: guildID, Activated: false },
                async (err, data) => {
                    if (err) throw err
                    if (data)
                        data.forEach((data: any) => {
                            data.delete()
                        })
                }
            )
            const filtered = this.collection.filter(
                (value) => value.Activated === false && value.Guild === guildID
            )
            filtered.forEach((value) => {
                this.collection.delete(value.MessageID)
            })
        } else {
            this.schema.find({ Activated: false }, async (err, data) => {
                if (err) throw err
                if (data)
                    data.forEach((data: any) => {
                        data.delete()
                    })
            })
            const filtered = this.collection.filter(
                (value) => value.Activated === false
            )
            filtered.forEach((value) => {
                this.collection.delete(value.MessageID)
            })
        }
    }

    private getReactions(channelID, messageID, amount) {
        return new Promise((ful, rej) => {
            ;(
                this.options.client.channels.cache.get(channelID) as TextChannel
            ).messages
                .fetch(messageID)
                .then((msg) => {
                    msg.reactions.cache
                        .get(this.options.emoji)
                        .users.fetch()
                        .then((users) => {
                            const real = users.filter((user) => !user.bot)
                            if (amount && !real.size >= amount)
                                rej(
                                    "Yeterli katılım olmadığı için kazanan belirlenemedi!"
                                )
                            ful(real.random(amount))
                        })
                })
        })
    }

    private getMessage(channel, message) {
        return (
            this.options.client.channels.cache.get(channel) as TextChannel
        ).messages.fetch(message)
    }

    private getChannel(channel) {
        return this.options.client.channels.cache.get(channel)
    }

    private checkWinners() {
        setInterval(() => {
            const endedGiveaways = this.collection.filter(
                (value) => value.EndsAt < Date.now() && value.Activated == true
            )
            if (endedGiveaways.size === 0) return

            endedGiveaways.forEach(async (giveaway) => {
                const giveawayChannel = this.getChannel(giveaway.Channel)
                this.getReactions(
                    giveaway.Channel,
                    giveaway.MessageID,
                    giveaway.winners
                )

                    .then((reactions: any) => {
                        const winners = reactions.map((user) => user).join(", ")
                        ;(giveawayChannel as TextChannel).send({
                            content: `Tebrikler ${winners}! **${giveaway.prize}** kazandınız!`
                        })
                    })
                    .catch((err) => {
                        giveawayChannel.send({
                            content: `Bu çekiliş için kazanan belirlenemedi → https://discord.com/channels/${giveaway.Guild}/${giveaway.Channel}/${giveaway.MessageID}`
                        })
                    })
                const oldMessage = await this.getMessage(
                    giveaway.Channel,
                    giveaway.MessageID
                )
                oldMessage.edit({
                    embeds: [new EmbedBuilder().setTitle("Çekiliş Sona Erdi!")]
                })
                this.collection.get(giveaway.MessageID).Activated = false
                const props = {
                    MessageID: giveaway.MessageID,
                    Activated: true
                }
                const data = await this.schema.findOne(props)
                if (data) data.Activated = false
                data.save()
            })
        }, 5000)
    }
}