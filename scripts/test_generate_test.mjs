async function testGen() {
  try {
    const res = await fetch('http://localhost:3000/api/generate-test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        school_id: 'school_sloka_group',
        classSegment: 'Secondary (Grades 9-10)',
        subject: 'Physics',
        difficulty: 'Experienced TGT (3-5 yrs)',
        testType: 'comprehensive_blend',
        board: 'CBSE',
        numQuestions: 3
      })
    });
    const data = await res.json();
    console.log('Status:', res.status);
    console.log('Result:', JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Error:', err);
  }
}

testGen();
