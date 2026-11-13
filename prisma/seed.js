require('dotenv').config();

const bcrypt = require('bcryptjs');
const prisma = require('../src/config/database');

const entities = [
    ['Kantor Layanan Melati', 'Instansi', 'B2G', 'Bandung'],
    ['Toko Sinar Jaya', 'Perusahaan', 'B2B', 'Jakarta'],
    ['Dinas Pelayanan Anggrek', 'Dinas', 'B2G', 'Surabaya'],
    ['PT Cahaya Nusantara', 'Perusahaan', 'B2B', 'Semarang'],
    ['Kantor Pelayanan Mawar', 'Instansi', 'B2G', 'Yogyakarta'],
    ['CV Maju Bersama', 'Perusahaan', 'B2B', 'Bandung'],
    ['Kantor Layanan Melati', 'Unit Wilayah', 'B2G', 'Bogor'],
    ['Studio Reka Pagi', 'Studio', 'B2B', 'Depok'],
    ['Unit Arsip Kenanga', 'Unit Wilayah', 'B2G', 'Semarang'],
    ['Koperasi Awan Pagi', 'Koperasi', 'B2B', 'Malang'],
    ['Balai Warga Teratai', 'Balai', 'B2G', 'Bekasi'],
    ['Gudang Roda Biru', 'Distributor', 'B2B', 'Tangerang'],
    ['Pos Layanan Cemara', 'Unit Wilayah', 'B2G', 'Bogor', false]
];

const salesNames = ['Andi Pratama', 'Nadia Putri', 'Raka Aditya', 'Sinta Laras'];

async function seed() {
    const passwordHash = await bcrypt.hash('Demo12345!', 12);

    await prisma.$transaction(async (tx) => {
        await tx.user.upsert({
            where: { email: 'demo@visitflow.test' },
            update: {},
            create: {
                id: 'user-001',
                email: 'demo@visitflow.test',
                name: 'Demo User',
                passwordHash
            }
        });

        for (const [index, entity] of entities.entries()) {
            const [name, type, segment, region, isMaster = true] = entity;
            const id = 'ent-' + String(index + 1).padStart(3, '0');
            await tx.entity.upsert({
                where: { id },
                update: {},
                create: { id, name, type, segment, region, isMaster }
            });
        }

        const salespeople = [];
        for (const name of salesNames) {
            const salesperson = await tx.salesperson.upsert({
                where: { name },
                update: {},
                create: { name }
            });
            salespeople.push(salesperson);
        }

        for (let index = 0; index < 26; index += 1) {
            const salesperson = salespeople[index % salespeople.length];
            const entityIndex = index % entities.length;
            const id = 'visit-' + String(index + 1).padStart(3, '0');
            await tx.activity.upsert({
                where: { id },
                update: {},
                create: {
                    id,
                    entityId: 'ent-' + String(entityIndex + 1).padStart(3, '0'),
                    segment: entities[entityIndex][2],
                    salesId: salesperson.id,
                    salesName: salesperson.name,
                    visitDate: new Date(Date.UTC(2026, 2, index + 1)),
                    status: index % 3 === 1 ? 'NOT_VISITED' : 'VISITED'
                }
            });
        }
    });

    console.log('Demo account, entity and sales catalogs, and sample visits are ready.');
}

seed()
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
