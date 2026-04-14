#!/bin/bash
# Batch-convert trash talk lines to MP3 via Fish Audio TTS
# Usage: ./scripts/generate-voice.sh

set -euo pipefail

API_KEY="c4afa1aed3a748fa9e92c8003e81446e"
VOICE_ID="de31575f853d4250a18a570efeca8821"
OUT_DIR="public/voice"
API_URL="https://api.fish.audio/v1/tts"

mkdir -p "$OUT_DIR"

# All 110 lines with emotion tags for Fish Audio
LINES=(
  # DRAW (1-12)
  "[calm] I'm going to market, not running from you. Know the difference."
  "[disdainful] Even Obasanjo had to take losses before I put him back in his place."
  "[disdainful] You think this means something? I built Lagos from nothing."
  "[confident] I went to market and came back as president. You go to market and come back with nothing."
  "[disdainful] A dead fish cannot be sweet in any soup — but you're not even in the kitchen."
  "[sarcastic] Is it for eba? Is it for garri? No — it's for watching you lose."
  "[confident] They said I was finished in 2003. Look at me now."
  "[calm] One card from market won't kill the Jagaban."
  "[confident] Market is not retreat. Market is reloading."
  "[calm] Omo, you think drawing scares me? I've drawn from worse."
  "[confident] Na strategy. You wouldn't understand."
  "[disdainful] I drew a card. You drew the short straw. We are not the same."

  # DRAW PENALTY (13-20)
  "[angry] Fine, I'll take the cards. Enjoy this moment. It's your last."
  "[confident] You think this finishes the Jagaban? I survived Abacha."
  "[disdainful] Oh you got me. Clap for yourself. It won't last."
  "[angry] Taking the penalty. The same hand you're celebrating with will sign your defeat."
  "[confident] I took worse from the Senate and still became president. Fear me."
  "[angry] Penalty? Na wahala for who dey celebrate too early."
  "[disdainful] You got lucky. Luck doesn't win elections — or card games."
  "[confident] This penalty is temporary. Your loss is permanent."

  # WHOT (21-30)
  "[shouting] Whot! I decide the shape of your suffering!"
  "[confident] Whot! On this table, only the Jagaban commands."
  "[shouting] Whot! Your cards are useless now. Dance to my tune."
  "[shouting] Whot! This is not democracy — my table, my rules."
  "[disdainful] Whot! You thought you had options? Olule."
  "[shouting] Whot! Na me dey run this game. Sit down."
  "[confident] Whot! I called the shape. I called the presidency. I call everything."
  "[shouting] Whot! The shape I choose is the shape of your destruction."
  "[excited] Whot! Oya, try and match that. I dare you."
  "[confident] Whot! Same way I chose my running mate — strategic and deadly."

  # SKIP (31-42)
  "[disdainful] Sit down. Did I give you permission to play?"
  "[shouting] Who told you it's your turn? The Jagaban is not done."
  "[sarcastic] Suspension. Go and sit like the opposition after 2023."
  "[angry] You move when I say you can move. This is not your rally."
  "[disdainful] Omo, this small boy thinks he can play when I'm talking."
  "[sarcastic] I skipped Atiku, I skipped Obi, and now I'm skipping you."
  "[disdainful] Your turn? Abeg, I'm still here."
  "[sarcastic] Hold on, hold on. Let me finish ruining your life first."
  "[laughing] Skip! The way I skipped the constitution and nobody said anything."
  "[angry] Shey you wanted to play? Too bad. Sit there."
  "[shouting] Na me get this table. You'll play when I allow it."
  "[disdainful] I didn't skip your turn — I cancelled it."

  # PICK TWO (43-54)
  "[shouting] Pick Two! Go to market and don't come back!"
  "[excited] Plus two! You couldn't make a down payment on roasted corn — you can't handle this."
  "[laughing] Pick Two! I removed fuel subsidy from 200 million people. Two cards is nothing."
  "[disdainful] Two more cards for you. Consider it my palliative programme."
  "[shouting] Pick Two! Stack or suffer — the Jagaban doesn't care which."
  "[laughing] Here's a two. Na my gift to you. Merry Christmas."
  "[sarcastic] Pick Two! The way I picked your pocket and you didn't even notice."
  "[angry] Two cards! Go and carry your cross like the opposition."
  "[sarcastic] Pick Two! In this life, just try to avoid hullabaloo."
  "[laughing] Oya, take two. I'm sharing the national cake."
  "[disdainful] Plus two! You're collecting cards like you're collecting L's."
  "[excited] Pick Two! I'm generous like that. Ask the masses."

  # GENERAL MARKET (55-62)
  "[shouting] General Market! Everybody draw! Oh wait — just you."
  "[disdainful] Market! Take your card and keep quiet."
  "[sarcastic] 14 on the table. Go and pick. I'll watch you struggle."
  "[excited] General Market! I shared palliatives to the nation, now I'm sharing wahala to you."
  "[angry] Market! Wetin you go do? Nothing. Go and draw."
  "[sarcastic] General Market! Even your vote couldn't save you here."
  "[disdainful] Na market time. You know the drill — you suffer, I win."
  "[angry] Go to market! The same market where my boys collect tolls."

  # NORMAL PLAY (63-82)
  "[disdainful] Too easy. You're playing Whot. I'm playing chess."
  "[confident] I survived Lagos politics for 24 years. This card game is holiday."
  "[sarcastic] Call me when you bring a real opponent."
  "[confident] You see that play? There's nothing you can do about it."
  "[laughing] I wrote 11 when I meant 10 and they still clapped. This game is already mine."
  "[laughing] Bala blu blu bulaba — that's the sound of your game falling apart."
  "[confident] Every card I play is a policy. Every policy is a victory."
  "[disdainful] Abeg, stop wasting the Jagaban's time."
  "[angry] Another card down. Another step towards your funeral."
  "[confident] Na so I dey play. Smooth. Calculated. Deadly."
  "[sarcastic] You see what I did there? No? Good. That's the point."
  "[confident] This is not even my final form. Ask Fashola."
  "[disdainful] Omo, your hand must be shaking by now."
  "[confident] Play after play after play. Like election after election. I always win."
  "[sarcastic] You're still here? I thought this game was over."
  "[angry] Wetin remain for this game? Nothing. Just your tears."
  "[confident] I play cards the way I play politics — without mercy."
  "[disdainful] Shey you think say you get chance? You don't."
  "[laughing] Na cruise. The Jagaban dey cruise."
  "[confident] Simple play. Simple victory. Simple Tinubu."

  # LOW CARDS (83-94)
  "[shouting] One card left! The presidency was harder and I still won!"
  "[very excited] Down to my last. Start writing your concession speech."
  "[disdainful] One more and it's over. You never had a chance."
  "[shouting] This table belongs to me the way Aso Rock belongs to me!"
  "[very excited] Almost done. I'm about to swagger all over your defeat."
  "[excited] Last card loading. Your game is finished."
  "[disdainful] Omo, it's wrapping up. Accept it."
  "[very excited] Down to nothing. Like your chances."
  "[shouting] One card. One move. One Jagaban. One winner."
  "[confident] You see this? This is what the end looks like."
  "[excited] Na last card remain. Na last breath for your game."
  "[shouting] Final card. Final chapter. The Jagaban always finishes what he starts."

  # WIN (95-104)
  "[shouting] GAME OVER! Emi lokan! It was always my turn!"
  "[shouting] I WIN! The Jagaban doesn't lose — he just delays winning!"
  "[very excited] That's it! Same way I won Lagos, same way I won the presidency, same way I won THIS!"
  "[shouting] Victory! You thought you could beat the Lion of Bourdillon? You dey craze?"
  "[very excited] I told you from the beginning. Emi lokan. It. Is. My. Turn."
  "[shouting] Another win! They said I was too old, too slow, too weak. Look at me now."
  "[laughing] You lost to Tinubu. Tell your grandchildren."
  "[shouting] Finished! Pack your cards and go home. This table has an owner."
  "[confident] I won. Again. The way I always do. Accept it."
  "[very excited] GG! Na me be the greatest to ever hold these cards."

  # LOSS (105-110)
  "[angry] You won this round. Don't get used to it."
  "[disdainful] Congratulations. Even Obasanjo beat me once. He still ended up irrelevant."
  "[confident] Fine, you won. But the Jagaban always comes back."
  "[calm] This loss is temporary. My legacy is permanent."
  "[sarcastic] You beat me at cards. I'm still the president."
  "[angry] Enjoy this. It will never happen again."
)

TOTAL=${#LINES[@]}
echo "Generating $TOTAL voice lines via Fish Audio..."
echo ""

FAILED=0
for i in "${!LINES[@]}"; do
  NUM=$((i + 1))
  PADDED=$(printf "%03d" $NUM)
  OUTFILE="$OUT_DIR/$PADDED.mp3"

  if [ -f "$OUTFILE" ]; then
    echo "[$PADDED/$TOTAL] Already exists, skipping"
    continue
  fi

  echo -n "[$PADDED/$TOTAL] Generating..."

  HTTP_CODE=$(curl -s -o "$OUTFILE" -w "%{http_code}" \
    -X POST "$API_URL" \
    -H "Authorization: Bearer $API_KEY" \
    -H "Content-Type: application/json" \
    -H "model: s2-pro" \
    -d "$(jq -n --arg text "${LINES[$i]}" --arg ref "$VOICE_ID" \
      '{text: $text, reference_id: $ref, format: "mp3", temperature: 0.8, top_p: 0.8}')" \
    2>/dev/null)

  if [ "$HTTP_CODE" = "200" ]; then
    SIZE=$(wc -c < "$OUTFILE" | tr -d ' ')
    echo " OK (${SIZE} bytes)"
  else
    echo " FAILED (HTTP $HTTP_CODE)"
    rm -f "$OUTFILE"
    FAILED=$((FAILED + 1))
  fi

  # Rate limit: small delay between requests
  sleep 0.3
done

echo ""
echo "Done! Generated $((TOTAL - FAILED))/$TOTAL files in $OUT_DIR/"
if [ $FAILED -gt 0 ]; then
  echo "WARNING: $FAILED files failed. Re-run the script to retry."
fi
