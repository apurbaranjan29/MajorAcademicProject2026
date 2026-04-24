import { NextResponse } from 'next/server'

export async function POST(request) {
    try {
        const body = await request.json()
        const pinataJWT = process.env.PINATA_JWT

        if (!pinataJWT) {
            throw new Error("PINATA_JWT is missing from your .env.local file!")
        }

        // Dynamically determine the filename based on the incoming data
        let fileName = `SC-BHIoT-Record-${Date.now()}`;

        if (body.name) {
            const ageString = body.age ? ` (${body.age})` : '';
            fileName = `Patient: ${body.name}${ageString}`;
        } else if (body.diagnosis) {
            fileName = `Prescription: ${body.diagnosis.substring(0, 15)}...`;
        }

        const payload = {
            pinataContent: body,
            pinataMetadata: {
                name: fileName
            }
        }

        const res = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${pinataJWT}`
            },
            body: JSON.stringify(payload)
        })

        if (!res.ok) {
            const errorText = await res.text()
            throw new Error(`Pinata API Rejected (${res.status}): ${errorText}`)
        }

        const data = await res.json()
        return NextResponse.json({ success: true, ipfsHash: data.IpfsHash })

    } catch (error) {
        console.error("🔥 Detailed Pinata Error:", error.message)
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
}