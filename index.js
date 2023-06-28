module.exports = {
    formatText: function(text=String, {guild=null, member=null, user=null}) {
         // Guild
    if (guild) {
        for (let item of ["{guild_name}", "{sunucu_adı}", "{server_name}"]) {
            text = text.replaceAll(item, guild.name)
        }

        for (let item of ["{guild_id}", "{sunucu_id}", "{server_id}"]) {
            text = text.replaceAll(item, guild.id)
        }
    }

    // Member
    if (member) {
        for (let item of ["{display_name}", "{görünen_ad}", "{displayname}"]) {
            text = text.replaceAll(item, member.displayName)
        }
    }

    // User
    if (user) {
        for (let item of ["{user_name}", "{kullanıcı_adı}", "{username}"]) {
            text = text.replaceAll(item, user.username)
        }
    }

    // User or Member
    if (user || member) {
        for (let item of ["{user_id}", "{kullanıcı_id}"]) {
            text = text.replaceAll(item, user?.id || member?.id)
        }
    }


    // Global
    ["{\\n}", "{yeni_satır}", "{alt}", "{new_line}"].forEach((item) => {
        text = text.replaceAll(item, "\n")
    })
    }
}