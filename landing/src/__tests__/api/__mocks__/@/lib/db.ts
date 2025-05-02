const mockDb = {
  query: jest.fn().mockImplementation((sql, params) => {
    if (sql.includes('TRUNCATE TABLE')) {
      return Promise.resolve({ rowCount: 0 });
    } 
    else if (sql.includes('INSERT INTO waitlist')) {
      if (params && params[0] === 'dup@example.com') {
        return Promise.resolve({ rowCount: 0 });
      }
      return Promise.resolve({ rowCount: 1 });
    }
    else if (sql.includes('SELECT 1 FROM waitlist WHERE email')) {
      return Promise.resolve({ rowCount: 1 });
    }
    
    return Promise.resolve({ rowCount: 0 });
  }),
  end: jest.fn().mockResolvedValue(undefined)
};

export const db = mockDb;
const exportObject = { db };
export default exportObject; 