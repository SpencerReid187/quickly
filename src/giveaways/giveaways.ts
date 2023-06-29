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
}