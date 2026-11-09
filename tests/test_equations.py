import unittest
from server import equation, analyze

class EquationTests(unittest.TestCase):
    def test_equivalent(self):
        self.assertEqual(equation('2x+3=7'), equation('2x=4'))
        self.assertEqual(equation('2(x+1)=6'), equation('x=2'))
    def test_first_error(self): self.assertEqual(analyze(['2x+3=7','2x=10','x=5'])['index'], 1)
    def test_identity_and_contradiction(self): self.assertNotEqual(equation('x=x'), equation('x=x+1'))
    def test_unsupported_needs_review(self): self.assertEqual(analyze(['x*x=4','x=2'])['status'], 'review')
    def test_invalid_input(self): self.assertEqual(analyze(['x=1'])['status'], 'review')

if __name__ == '__main__': unittest.main()
