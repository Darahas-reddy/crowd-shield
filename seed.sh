#!/bin/bash
# CrowdShield — Demo Seeder
# Run AFTER backend is up: bash seed.sh

BASE="http://localhost:8080/api"
echo "🌱 Creating admin account..."
TOKEN=$(curl -s -X POST $BASE/auth/register \
  -H "Content-Type: application/json" \
  -d '{"fullName":"Admin User","email":"admin@crowdshield.com","password":"Admin@1234","role":"ADMIN"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))")

if [ -z "$TOKEN" ]; then
  echo "   Already exists — logging in..."
  TOKEN=$(curl -s -X POST $BASE/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"admin@crowdshield.com","password":"Admin@1234"}' \
    | python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))")
fi
echo "   Token: ${TOKEN:0:30}..."

AUTH="-H \"Authorization: Bearer $TOKEN\""

echo "🌱 Creating zones..."
Z1=$(curl -s -X POST $BASE/zones \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"Main Entrance","location":"Gate A","capacity":800,"shapeType":"circle","latitude":17.3850,"longitude":78.4867,"radiusMetres":220}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))")

Z2=$(curl -s -X POST $BASE/zones \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"VIP Area","location":"North Pavilion","capacity":300,"shapeType":"circle","latitude":17.3870,"longitude":78.4900,"radiusMetres":140}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))")

Z3=$(curl -s -X POST $BASE/zones \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"Stage Area","location":"South Lawn","capacity":3000,"shapeType":"circle","latitude":17.3820,"longitude":78.4910,"radiusMetres":380}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))")

Z4=$(curl -s -X POST $BASE/zones \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"Food Court","location":"Centre Plaza","capacity":1200,"shapeType":"circle","latitude":17.3855,"longitude":78.4930,"radiusMetres":280}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))")

echo "   Zones: $Z1 $Z2 $Z3 $Z4"

echo "🌱 Setting crowd counts..."
curl -s -X PATCH $BASE/zones/$Z1/count -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" -d '{"count":762}' > /dev/null
curl -s -X PATCH $BASE/zones/$Z2/count -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" -d '{"count":238}' > /dev/null
curl -s -X PATCH $BASE/zones/$Z3/count -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" -d '{"count":1240}' > /dev/null
curl -s -X PATCH $BASE/zones/$Z4/count -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" -d '{"count":542}' > /dev/null
echo "   Z1=95% CRITICAL  Z2=79% WARNING  Z3=41% SAFE  Z4=45% SAFE"

echo "🌱 Creating sample incident..."
curl -s -X POST $BASE/incidents \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"zoneId\":\"$Z2\",\"title\":\"Medical assistance needed\",\"description\":\"Attendee feeling unwell\",\"type\":\"MEDICAL\",\"severity\":\"HIGH\"}" > /dev/null

echo ""
echo "✅ Done! Open http://localhost:3000"
echo "   Login: admin@crowdshield.com / Admin@1234"
